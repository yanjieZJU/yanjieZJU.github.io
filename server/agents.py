import os
import re
import httpx
import json
import sys
import os
from openai import OpenAI
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import concurrent.futures
import hashlib

# Add parent directory to path for config import
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import *
from retriever_neo4j import (
    get_vector_store,
    get_graph_store,
    retrieve_and_get_content,
    find_structural_path,
    run_with_retry,
    execute_read_with_session
)

http_client = httpx.Client(proxy=None, trust_env=False)
client = OpenAI(
    http_client=http_client,
    api_key=os.environ.get("OPENAI_API_KEY"),
    base_url=os.environ.get("OPENAI_BASE_URL")
    )

# Global cache for cluster embeddings to avoid recomputation
CLUSTER_EMBEDDINGS_CACHE = {}

def get_cluster_embeddings_cache_key(cluster_data):
    """Generate a cache key based on cluster data content."""
    cluster_text = json.dumps(cluster_data, sort_keys=True)
    return hashlib.md5(cluster_text.encode()).hexdigest()

def load_cached_embeddings():
    """Load cached embeddings from file if available."""
    cache_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kg_cluster", "embeddings_cache.json")
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {}

def save_embeddings_cache(cache_data):
    """Save embeddings cache to file."""
    cache_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kg_cluster", "embeddings_cache.json")
    try:
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Warning: Failed to save embeddings cache: {e}")

# Load cache on module import
CLUSTER_EMBEDDINGS_CACHE = load_cached_embeddings()

TAXONOMY = """
1. **sensing_input**
    - bio_sensor: internal human physiological signals, e.g., EEG, EMG, ECG
    - behavior_sensor: external human behaviors/movements. e.g., IMU, eye tracker, motion capture
    - env_sensor: environment perception, e.g., RGB Camera, temperature sensor
    - direct_input: direct human-computer interaction input based on interfaces, e.g., Keyboard, Mouse, Touchscreen
    - system_context: equipment, system status and application log, etc.
    - data_import: offline documents, knowledge base, third-party API stream that serve as inputs
2. **processing_core**
    - signal_optimization: making the signal cleaner without changing the data type, e.g., filter, normalizer
    - feature_extraction: convert raw high-dimensional data (images, audio streams) into structured features or symbolic representations, e.g., gaze tracker, pose estimator, speech-to-text
    - state_assessment: qualitative or quantitative evaluation of the extracted features (judge how good/bad/intense something is), e.g., emotion recognition, fatigue detection
    - decision_logic: determine the next step based on the state assessment, e.g., recommender logic, dialog manager (even if it uses an LLM, if the output is a control flag or strategy, it belongs here)
    - content_generation: e.g., text generation (llm, chatbot), image generation (diffusion model)
3. **interface_output**
    - immersive_display: immersive visual output, e.g., VR headset, AR glasses, Unity Scene
    - gui_display: traditional visual display, e.g., Web UI, Mobile screen
    - haptic_feedback: e.g., Vibration motors, exoskeleton feedback
    - audio_output: e.g., TTS, Sound effects
4. **infrastructure**
    - data_storage: storage unit, e.g., vector DB, Database, Knowledge graph
    - communication: e.g., HTTP Server, WebSocket, Bluetooth
    - model_lifecycle: model repository/version, training and post-training pipeline, online learning, etc. 
    - personalization_store: user persona, prefenrence, threshold / calibration parameters, etc.
"""

class PlannerAgent:
    def _precompute_cluster_embeddings(self):
        if not self.topology_knowledge: return
        
        clusters = self.topology_knowledge.get("scene_clusters", {})
        print(f"Pre-computing embeddings for {len(clusters)} clusters...")
        
        # Generate cache key for current topology knowledge
        topology_hash = get_cluster_embeddings_cache_key(self.topology_knowledge)
        
        # Check if we have cached embeddings for this topology
        if topology_hash in CLUSTER_EMBEDDINGS_CACHE:
            print(f"✅ Using cached embeddings for topology {topology_hash[:8]}...")
            self.cluster_embeddings = CLUSTER_EMBEDDINGS_CACHE[topology_hash]
            return
            
        print(f"🔄 Computing new embeddings for topology {topology_hash[:8]}...")
        
        # Compute new embeddings
        new_embeddings = {}
        for label, data in clusters.items():
            text = data.get("name", "")
            if text:
                try:
                    resp = self.client.embeddings.create(input=text, model="text-embedding-3-small")
                    emb = resp.data[0].embedding
                    new_embeddings[label] = emb
                except Exception as e:
                    print(f"Error embedding cluster {label}: {e}")
        
        # Update cache
        self.cluster_embeddings = new_embeddings
        CLUSTER_EMBEDDINGS_CACHE[topology_hash] = new_embeddings
        save_embeddings_cache(CLUSTER_EMBEDDINGS_CACHE)
        print(f"💾 Saved embeddings to cache for topology {topology_hash[:8]}")

    def match_scenario(self, query):
        if not self.cluster_embeddings: return None, None
        
        try:
            resp = self.client.embeddings.create(input=query, model="text-embedding-3-small")
            query_emb = np.array(resp.data[0].embedding).reshape(1, -1)
        except:
            return None, None
            
        best_label = None
        best_score = -1
        
        for label, emb in self.cluster_embeddings.items():
            emb_arr = np.array(emb).reshape(1, -1)
            score = cosine_similarity(query_emb, emb_arr)[0][0]
            if score > best_score:
                best_score = score
                best_label = label
                
        return best_label, best_score

    def __init__(self, client, graph_store):
        self.client = client
        self.graph_store = graph_store
        
        # Load Topology Knowledge
        self.topology_knowledge = {}
        try:
            # Path relative to this file: ./kg_cluster/System_Topology_Knowledge.json
            base_dir = os.path.dirname(os.path.abspath(__file__)) # server dir
            topo_path = os.path.join(base_dir, "kg_cluster", "System_Topology_Knowledge.json")
            with open(topo_path, "r", encoding="utf-8") as f:
                self.topology_knowledge = json.load(f)
            print("✅ Loaded System Topology Knowledge.")
        except Exception as e:
            print(f"⚠️ System Topology Knowledge not found: {e}")
            
        # Cache Cluster Embeddings
        self.cluster_embeddings = {}
        self._precompute_cluster_embeddings()
        self.client = client
        self.graph_store = graph_store  

    def divergent_planning(self, user_query, base_anchors, num_outputs=2):
        """
        Generates divergent extension plans based on the user query and already extracted base anchors.
        Uses Knowledge-Distance Perspective Injection to find both near-field and far-field inspirations.
        """
        
        # Format base anchors for the prompt
        base_anchors_str = json.dumps([a['user_term'] for a in base_anchors], ensure_ascii=False)
        
        # 1. Calculate similarities with ALL clusters
        if not self.cluster_embeddings: 
            print("No cluster embeddings available for divergent planning.")
            return []

        try:
            resp = self.client.embeddings.create(input=user_query, model="text-embedding-3-small")
            query_emb = np.array(resp.data[0].embedding).reshape(1, -1)
        except Exception as e:
            print(f"Error embedding query: {e}")
            return []

        scored_clusters = []
        all_labels = list(self.cluster_embeddings.keys())
        all_embs = np.array([self.cluster_embeddings[l] for l in all_labels])
        scores = cosine_similarity(query_emb, all_embs)[0]
        scored_clusters = sorted(zip(all_labels, scores.tolist()), key=lambda x: x[1], reverse=True)
        
        # 2. Select Reference Clusters (Near vs Far)
        # Strategy:
        # - Plan 0 (if num_outputs > 0) -> Near Field (Top 1) -> "Deep Dive"
        # - Plan 1..N -> Far Field (Random from score 0.3 - 0.6) -> "Cross-domain Transfer"
        
        # Enforce max outputs to 3 as requested
        num_outputs = min(max(1, num_outputs), 3)

        selected_references = []

        def _find_neighbor_cluster_ids(primary_id, candidate_pool, exclude_ids, max_neighbors=2, sim_threshold=0.6):
            """
            Among candidate_pool (list of (cluster_id, query_score)), return up to max_neighbors
            cluster IDs whose embedding similarity to primary_id is >= sim_threshold,
            excluding any IDs in exclude_ids. Candidates are already query-filtered (0.3-0.6),
            so neighbors are both domain-adjacent AND query-relevant.
            """
            if primary_id not in self.cluster_embeddings:
                return []
            primary_emb = np.array(self.cluster_embeddings[primary_id]).reshape(1, -1)
            neighbors = []
            for other_id, _ in candidate_pool:
                if other_id == primary_id or other_id in exclude_ids:
                    continue
                if other_id not in self.cluster_embeddings:
                    continue
                sim = cosine_similarity(primary_emb, np.array(self.cluster_embeddings[other_id]).reshape(1, -1))[0][0]
                if sim >= sim_threshold:
                    neighbors.append((other_id, sim))
            neighbors.sort(key=lambda x: x[1], reverse=True)
            return [n[0] for n in neighbors[:max_neighbors]]

        # A. Near Field (Top 1) — logic unchanged
        if scored_clusters:
            near_cluster_id = scored_clusters[0][0]
            near_score = scored_clusters[0][1]

            if near_score < 0.5:
                selected_references.append({
                    "type": "NEAR_FIELD_MISSING",
                    "cluster_id": None,
                    "cluster_ids": [],
                    "score": near_score,
                    "name": "No Relevant Papers Found"
                })
                print(f"⚠️ Near-Field Context Score low ({near_score:.2f} < 0.5). Marked as missing.")
            else:
                selected_references.append({
                    "type": "NEAR_FIELD",
                    "cluster_id": near_cluster_id,
                    "cluster_ids": [near_cluster_id],
                    "score": near_score,
                    "name": self.topology_knowledge["scene_clusters"][near_cluster_id]["name"]
                })
                print(f"🎯 Near-Field Context: {self.topology_knowledge['scene_clusters'][near_cluster_id]['name'][:50]}... (Score: {near_score:.2f})")

        # B. Far Field (Random Sampling)
        # Each far-field perspective samples an anchor cluster, then expands with 1-2 same-domain
        # neighbors so the LLM receives a coherent cluster of related techniques.
        near_id_set = {scored_clusters[0][0]} if scored_clusters else set()
        far_candidates = [c for c in scored_clusters if 0.3 <= c[1] <= 0.6 and c[0] not in near_id_set]

        needed_far = max(0, num_outputs - 1)
        if far_candidates and needed_far > 0:
            import random
            k = min(len(far_candidates), needed_far)
            chosen_far = random.sample(far_candidates, k)
            used_far_ids = set()

            for c_id, c_score in chosen_far:
                used_far_ids.add(c_id)
                neighbor_ids = _find_neighbor_cluster_ids(
                    c_id,
                    candidate_pool=far_candidates,
                    exclude_ids=near_id_set | used_far_ids,
                    max_neighbors=2,
                    sim_threshold=0.6
                )
                used_far_ids.update(neighbor_ids)
                all_cluster_ids = [c_id] + neighbor_ids
                selected_references.append({
                    "type": "FAR_FIELD",
                    "cluster_id": c_id,
                    "cluster_ids": all_cluster_ids,
                    "score": c_score,
                    "name": self.topology_knowledge["scene_clusters"][c_id]["name"]
                })
                print(f"🚀 Far-Field Context: {self.topology_knowledge['scene_clusters'][c_id]['name'][:50]}... "
                      f"(Score: {c_score:.2f}, +{len(neighbor_ids)} neighbors: {neighbor_ids})")

        # Fill remaining with random near/mid if we ran out of far candidates
        while len(selected_references) < num_outputs:
            existing_ids = {
                c_id for r in selected_references
                for c_id in r.get("cluster_ids", [])
                if c_id is not None
            }
            residue = [c for c in scored_clusters if c[0] not in existing_ids]
            if not residue:
                break
            c_id, c_score = residue[0]
            selected_references.append({
                "type": "SUPPLEMENTAL",
                "cluster_id": c_id,
                "cluster_ids": [c_id],
                "score": c_score,
                "name": self.topology_knowledge["scene_clusters"][c_id]["name"]
            })
        
        # 3. Retrieve Capabilities for specific references
        # We want to give the LLM specific "Reference Packs"
        
        reference_context_str = ""

        # Pre-fetch community summaries for all selected references in parallel
        def _fetch_summaries_for_ref(ref):
            if ref["type"] == "NEAR_FIELD_MISSING":
                return ref.get("cluster_id"), [], []
            cluster_ids = ref.get("cluster_ids", [ref.get("cluster_id")])
            cluster_ids = [c for c in cluster_ids if c is not None]
            if not cluster_ids:
                return None, [], []

            primary_id = cluster_ids[0]

            # Merge community_distribution across all clusters in this reference pack.
            # Weight each cluster's distribution equally so dominant communities from any
            # cluster surface; use a dict to accumulate scores.
            merged_comm_scores: dict = {}
            for c_id in cluster_ids:
                cdata = self.topology_knowledge["scene_clusters"].get(c_id, {})
                for comm, score in cdata.get("community_distribution", {}).items():
                    merged_comm_scores[comm] = merged_comm_scores.get(comm, 0) + score

            if not merged_comm_scores:
                return primary_id, [], []

            sorted_comms = sorted(merged_comm_scores.items(), key=lambda x: x[1], reverse=True)

            # Top-3 dominant communities (across all merged clusters)
            top_comm_ids = [c[0] for c in sorted_comms[:3]]

            # 2 random tail communities (rank 6–20 of merged ranking)
            import random
            tail_candidates = [c[0] for c in sorted_comms[5:20]]
            tail_comm_ids = random.sample(tail_candidates, min(2, len(tail_candidates)))

            relevant_comm_ids = top_comm_ids + tail_comm_ids
            tail_set = set(tail_comm_ids)

            def _fetch_comm_summaries(tx, comm_ids):
                cypher = """
                MATCH (n:LlamaNode)
                WHERE n.community_L0 IN $comm_ids
                RETURN DISTINCT n.community_L0 as id, n.summary_L0 as summary
                """
                result = tx.run(cypher, comm_ids=comm_ids)
                return list(result)
            try:
                records = run_with_retry(
                    lambda: execute_read_with_session(self.graph_store._driver, _fetch_comm_summaries, relevant_comm_ids)
                )
                lines = []
                for r in records:
                    tag = " *(long-tail — distinctive niche)*" if r['id'] in tail_set else ""
                    lines.append(f"- [Community {r['id']}]{tag}: {r['summary']}")
                return primary_id, lines, relevant_comm_ids
            except Exception as e:
                print(f"⚠️ Failed to fetch community summaries for planning: {e}")
                return primary_id, [], []

        refs_needing_fetch = [r for r in selected_references if r["type"] != "NEAR_FIELD_MISSING" and r.get("cluster_ids")]
        comm_summaries_cache = {}   # c_id -> lines
        comm_ids_cache = {}         # c_id -> list of community ids shown to LLM
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(refs_needing_fetch) or 1) as _ex:
            for c_id, lines, comm_ids in _ex.map(_fetch_summaries_for_ref, refs_needing_fetch):
                if c_id is not None:
                    comm_summaries_cache[c_id] = lines
                    comm_ids_cache[c_id] = comm_ids

        # Build cross-plan shared community set for dedup hint
        all_comm_id_lists = list(comm_ids_cache.values())
        if len(all_comm_id_lists) >= 2:
            from collections import Counter
            flat = [cid for lst in all_comm_id_lists for cid in lst]
            shared_communities = {cid for cid, cnt in Counter(flat).items() if cnt > 1}
        else:
            shared_communities = set()

        for idx, ref in enumerate(selected_references):
            if ref["type"] == "NEAR_FIELD_MISSING":
                ref_block = f"""
            ### Source {idx + 1} (Near-Field):
            Condition: Similarity score {ref['score']:.2f} < 0.5.
            Message: No papers highly relevant to this system were retrieved.
            """
                reference_context_str += ref_block
                continue

            c_id = ref.get("cluster_id") or (ref.get("cluster_ids") or [None])[0]
            if c_id is None: continue

            cluster_data = self.topology_knowledge["scene_clusters"][c_id]
            comm_summaries_text = comm_summaries_cache.get(c_id, [])

            # Extract Common Patterns with Claims — from all clusters in this reference pack
            patterns_text = []
            for ref_c_id in ref.get("cluster_ids", [c_id]):
                ref_cluster_data = self.topology_knowledge["scene_clusters"].get(ref_c_id, {})
                for p_key in ["common_patterns_3", "common_patterns_4"]:
                    patterns = ref_cluster_data.get(p_key, [])
                    patterns.sort(key=lambda x: x.get("count", 0), reverse=True)
                    for pat in patterns[:2]:
                        seq = pat.get("sequence", [])
                        claim = pat.get("claim", "")
                        if seq and claim:
                            seq_str = " -> ".join(seq)
                            patterns_text.append(f"- Pattern: [{seq_str}]\n  * Insight: {claim}")

            patterns_section = ""
            if patterns_text:
                patterns_section = "\n**Common Workflow Patterns & Insights:**\n" + "\n".join(patterns_text)

            extra_clusters = ref.get("cluster_ids", [c_id])
            cluster_note = f" (+{len(extra_clusters)-1} related clusters)" if len(extra_clusters) > 1 else ""
            ref_block = f"""
            ### Source {idx + 1} ({ref['type']} - Dist: {1-ref['score']:.2f}): {cluster_data['name']}{cluster_note}
            **Key Functional Communities in this domain:**
            {chr(10).join(comm_summaries_text)}
            {patterns_section}
            """
            print(ref_block)
            reference_context_str += ref_block

        # Append shared-community hint so LLM knows which ones to avoid overusing
        if shared_communities:
            reference_context_str += f"""
            ### Cross-Source Note
            Communities {sorted(shared_communities)} appear in **multiple** sources above.
            These are general-purpose communities shared across domains. When assigning `community_id` to additional_anchors, **prefer the long-tail communities** (marked with "long-tail") over the shared ones to maximize differentiation between plans.
            """

        prompt = f"""
        You are a creative System Architect. You are required to design a system based on the user's requirements. Remember that you are facing a designer, so do not use too much technical jargon (like xxx algorithm, engine, neural network, etc.).
        
        ## Context
        The user wants to design a system described as: ```{user_query}```.
        We have already identified the following BASE components (Anchors): ```{base_anchors_str}```.
        
        ## Task
        Generate **{num_outputs}** DISTINCT and DIVERGENT extension plans from different function implementation paths to enhance this system. 
        No matter what perspective you adopt, always keep *align with user requirements* as the primary goal. You can achieve this by using different functions or technologies.

        ## Language Policy
        - Understand the user's input as-is (Chinese or English) without changing its intent.
        - Keep internal reasoning and retrieval assumptions unchanged.
        - Final JSON text fields should be primarily in Chinese for user-facing readability.
        - Proper nouns, model names, protocol names, and indispensable technical terms may remain in English.
        
        ## Reference Material (Inspiration Only — Not a Template)
        We have retrieved knowledge from adjacent domains to spark divergent thinking.
        **Do NOT copy or directly map these references into your plan.** Instead, extract the *underlying mechanism or design principle* and re-express it in the user's specific scenario.
        Ask yourself: "What functional problem does this reference solve, and how can I solve the analogous problem in the user's context?"
        If a reference feels irrelevant or forces an unnatural fit, **ignore it** and rely on domain reasoning instead.
        
        {reference_context_str}
        
        ## Requirements by Plan

        **Plan 1 (Deep Optimization)**:
        - Use **Source 1** (Near-Field) as inspiration. Extract the *core design principle* from the community summaries — do not port technology names or module structures wholesale.
        - If Source 1 states "No papers highly relevant", focus strictly on the user's own scenario: deeply analyze the Base Anchors and the user's requirements to propose functional enhancements that are a **natural, direct extension** of the existing system.
        - Prioritize **feasibility and scenario fit** over novelty. All additional_anchors must directly serve the user's stated goal.

        **Plan 2 (Cross-Domain Inspiration)** (If requested):
        - Use **Source 2** (Far-Field) as your inspiration. Clearly define the core mechanism and advantages of this analogy, and ensure that it significantly differs from other plans.
        - Focus on **innovative cross-domain transfer**: Instead of just introducing conventional ideas, extract typical processing patterns, novel technologies or main implementation methods from Source 2 that can significantly improve the performance of the system.
        - Perform **Concept Blending**: specific methods from Source 2 (e.g., "Medical Monitoring") should be metaphorically and innovatively transferred to the User's domain (e.g., "Education Monitoring").
        - **CRITICAL**: Cross-domain transfer must stay grounded in the user's scenario. The resulting additional_anchors must be recognizable as serving the user's stated goal. Do NOT simply import modules wholesale from Source 2 — they must be adapted, renamed, and functionally redefined in the user's context.

        **Plan 3+** (If requested):
        - Use **Source 3+** similarly to propose a DISTINCT innovative functional embedding, differing in implementation methods or referenced technologies from previous plans.
        - Apply the same grounding constraint as Plan 2: all anchors must clearly serve the user's stated scenario.

        ## General Constraint
        1. When you add new functions, always consider its *feasibility* in the given context.
        2. **Base Anchors Preservation**:
           - **CRITICAL**: The existing Base Anchors represent the core of the system. Your divergent plans MUST acknowledge them, build upon them, and seamlessly integrate new functionalities with them across ALL plans.
        3. **Incremental Only**:
           - Do NOT output the existing Base Anchors in your array. Output ONLY the KEY and ADDITIONAL innovative components (modules). IF Base Anchors do NOT exist, extract the key components from the user's query and add them.
           - **CRITICAL**: Do NOT propose modules that are merely synonyms or simple rephrasings of Base Anchors (e.g., if "Tutor" exists, do not add "Instructor Agent"). New anchors must add **distinct and innovative new functionality**.
           - **LIMIT**: Output at most **5** additional anchors per plan. Prioritize the most impactful and distinctive ones.
        4. **Specific Anchors**:
           - Each additional component must have a 'user_term', a 'description', a 'role', and a 'community_id' (from the reference source).
           - Recheck data flow logic.
        5. **Cross-Plan Differentiation (CRITICAL)**:
           - Before finalizing your output, review ALL plans together. **No two plans may share more than 1 anchor with the same `community_id`.**
           - If two plans would share a community_id on more than 1 anchor, replace the overlapping anchor in the lower-priority plan with a module grounded in a **long-tail community** (marked "long-tail" in the source, which appears less frequently but is more innovative ) or a different community entirely.
           - The `perspective` phrases of all plans must be meaningfully different — they must highlight distinct functional innovations, not just rephrase the same concept.

        ### Role Taxonomy
        {TAXONOMY}\n\n

        ## Naming and Description Rules for Anchors
        - **user_term**: Must be scenario-specific — include concrete nouns from the user's domain (e.g., if the system is about "采摘机器人", use "采摘任务分配" not "任务分配", "果实识别" not "目标识别"). Short (2–8 chars), action or object oriented.
        - **description**: Must explicitly state (1) what data/input this module receives, (2) what it does to that data, and (3) what output it produces. Example format: "接收[输入]，通过[处理方式]，输出[输出结果]". Avoid abstract summaries like "进行智能决策" — say exactly WHAT decision, based on WHAT input.

        ## Output Structure (JSON)
        {{
            "plans": [
                {{
                    "perspective": "use one short phrase to describe the perspective, highlighting the key functions or biggest advantages and innovations of this design (e.g., 'Immersive interactive feedback'). Do not just copy the perspective title or vague terms like 'cross-domain'",
                    "rationale": "Explain explicitly: 'Inspired by [Source Name: Feature], we introduced [Function] to achieve [Goal]...' Ground it in the user's specific scenario.",
                    "additional_anchors": [
                        {{
                            "user_term": "Scenario-specific module name (e.g., '果实成熟度识别' not '目标识别')",
                            "description": "接收[具体输入]，通过[具体处理]，输出[具体结果]",
                            "role": "category: subcategory",
                            "community_id": "ID from Source text, use NONE if no match"
                        }}
                    ]
                }},
                ...
            ]
        }}
        """
        # print(prompt)
        print(f"\n🧠 Generating {num_outputs} divergent plans...")
        import time
        last_err = None
        for _attempt in range(3):
            try:
                response = self.client.chat.completions.create(
                    model=CHAT_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.9,
                    response_format={"type": "json_object"},
                ).choices[0].message.content
                result = json.loads(response)
                plans = result.get("plans", [])
                # Hard cap: at most 4 additional_anchors per plan to prevent retrieval explosion
                for plan in plans:
                    anchors = plan.get("additional_anchors", [])
                    if len(anchors) > 5:
                        print(f"⚠️ Trimming additional_anchors from {len(anchors)} to 4")
                        plan["additional_anchors"] = anchors[:4]
                if len(plans) < num_outputs:
                    print(f"⚠️ Warning: LLM generated {len(plans)} plans, requested {num_outputs}.")
                return plans[:num_outputs]
            except Exception as e:
                last_err = e
                print(f"❌ Error in divergent planning (attempt {_attempt+1}): {e}")
                if _attempt < 2:
                    time.sleep(3 * (_attempt + 1))
        return []

        
        
        
class RetrieverAgent:
    def __init__(self, vector_store, graph_store, client):
        self.vector_store = vector_store
        self.graph_store = graph_store
        self.client = client

    def retrieve_for_module(self, anchors_list, top_k=3, include_topology=True):
        anchor_mapping = {}
        
        def fetch_single_anchor(anchor):
            user_term = anchor["user_term"]
            description = anchor["description"]
            role = anchor.get("role", None)
            community_id = anchor.get("community_id", None)
            
            query_text = f"{user_term}: {description}"
            
            retrieved_nodes = retrieve_and_get_content(
                query_text, 
                self.vector_store, 
                self.graph_store, 
                top_k,
                node_type="MODULE",
                role_filter=role,
                community_id=community_id,
                include_topology=include_topology
            )
            return user_term, retrieved_nodes

        with concurrent.futures.ThreadPoolExecutor(max_workers=min(10, len(anchors_list) or 1)) as executor:
            future_to_anchor = {executor.submit(fetch_single_anchor, anchor): anchor for anchor in anchors_list}
            for future in concurrent.futures.as_completed(future_to_anchor):
                try:
                    user_term, retrieved_nodes = future.result()
                    if retrieved_nodes:
                        anchor_mapping[user_term] = retrieved_nodes
                        for n in retrieved_nodes:
                            print(f"Found: {n.node.metadata.get('name', '')} (Score: {n.score:.4f})")
                except Exception as exc:
                    print(f"Retrieval generated an exception: {exc}")

        return anchor_mapping
    
    def retrieve_structure_paths(self, user_relations):
        structural_hints = []
        
        def fetch_single_path(rel):
            src = rel["source"]
            tgt = rel["target"]
            return find_structural_path(src, tgt, rel_type=rel["type"], vector_store=self.vector_store, graph_store=self.graph_store)
            
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(10, len(user_relations) or 1)) as executor:
            future_to_rel = {executor.submit(fetch_single_path, rel): rel for rel in user_relations}
            for future in concurrent.futures.as_completed(future_to_rel):
                try:
                    paths = future.result()
                    structural_hints.extend(paths)
                except Exception as exc:
                    print(f"Structural path retrieval generated an exception: {exc}")

        return structural_hints


def _expand_compact_ports(response_str):
    """
    Convert compact port strings back to the full object format expected by
    ConflictSolver and the frontend.

    Compact formats:
      incoming:      "SourceMod->label"  or  "SourceMod.SubNode->label"
      outgoing:      "TargetMod->label"  or  "TargetMod.SubNode->label"
      internal_flow: "SubA->SubB->label"
    """
    if not response_str:
        return response_str
    try:
        data = json.loads(response_str)
    except Exception:
        return response_str

    modules = data.get("module_details", [])
    if isinstance(modules, dict):
        modules = list(modules.values())

    for mod in modules:
        ports = mod.get("ports")
        if not isinstance(ports, dict):
            continue

        # --- incoming ---
        raw_in = ports.get("incoming", [])
        expanded_in = []
        for item in raw_in:
            if isinstance(item, dict):
                expanded_in.append(item)
                continue
            if not isinstance(item, str):
                continue
            # split on last "->" to get label
            arrow = item.rfind('->')
            if arrow == -1:
                continue
            src_part = item[:arrow].strip()
            label = item[arrow+2:].strip()
            if '.' in src_part:
                src_mod, src_node = src_part.split('.', 1)
            else:
                src_mod, src_node = src_part, None
            expanded_in.append({
                "source_mod": src_mod.strip(),
                "source_node": src_node.strip() if src_node else None,
                "connects_to_internal_node": None,
                "edge_label": label
            })
        ports["incoming"] = expanded_in

        # --- outgoing ---
        raw_out = ports.get("outgoing", [])
        expanded_out = []
        for item in raw_out:
            if isinstance(item, dict):
                expanded_out.append(item)
                continue
            if not isinstance(item, str):
                continue
            arrow = item.rfind('->')
            if arrow == -1:
                continue
            tgt_part = item[:arrow].strip()
            label = item[arrow+2:].strip()
            if '.' in tgt_part:
                tgt_mod, tgt_node = tgt_part.split('.', 1)
            else:
                tgt_mod, tgt_node = tgt_part, None
            expanded_out.append({
                "target_mod": tgt_mod.strip(),
                "target_node": tgt_node.strip() if tgt_node else None,
                "originates_from_internal_node": None,
                "edge_label": label
            })
        ports["outgoing"] = expanded_out

        # --- internal_flow ---
        raw_flow = ports.get("internal_flow", [])
        expanded_flow = []
        for item in raw_flow:
            if isinstance(item, dict):
                expanded_flow.append(item)
                continue
            if not isinstance(item, str):
                continue
            # format: "SubA->SubB->label"  (first two arrows are node separators)
            parts = item.split('->')
            if len(parts) >= 3:
                src_node = parts[0].strip()
                tgt_node = parts[1].strip()
                label = '->'.join(parts[2:]).strip()
            elif len(parts) == 2:
                src_node = parts[0].strip()
                tgt_node = parts[1].strip()
                label = ""
            else:
                continue
            expanded_flow.append({
                "source_node": src_node,
                "target_node": tgt_node,
                "edge_label": label
            })
        ports["internal_flow"] = expanded_flow

    return json.dumps(data, ensure_ascii=False)


class IntegratorAgent:
    def __init__(self, client):
        self.client = client

    def format_hints(self, structural_hints):
        if not structural_hints:
            return ""
        
        hints_text = "### Validated Connection Paths from Literature\n"
        for i, path in enumerate(structural_hints):
            chain_desc = []
            nodes = path['path_nodes']
            rels = path.get('relations', [])
            rel_props = path.get('rel_props', [])
            
            # Build chain description
            # Append functional description to provide context
            start_node_name = nodes[0]['name']
            chain_desc.append(f"[{start_node_name}]")
            
            for j, rel in enumerate(rels):
                target_node = nodes[j+1]['name']
                if nodes[j+1].get('function'):
                    target_node += f" ({nodes[j+1]['function']}...)"
                elif nodes[j+1].get('text'):
                    target_node += f" ({nodes[j+1]['text'][:300]}...)"
                
                # Extract edge label if available
                data_content = ""
                if j < len(rel_props) and rel_props[j] and 'edge_label' in rel_props[j]:
                    lbl = rel_props[j]['edge_label']
                    if lbl and lbl != "null":
                        data_content = f": {lbl}"

                if rel == "FLOWS_TO":
                    chain_desc.append(f" --(label: {data_content})--> [{target_node}]")
                elif rel == "HAS_ROLE":
                        chain_desc.append(f" ==(equivalent role)==> [{target_node}]")
                else:
                        chain_desc.append(f" --({rel}{data_content})--> [{target_node}]")

            hints_text += f"   * Connection '{path['source_query']} -> {path['target_query']}':\n"
            hints_text += f"     Reference Path: {''.join(chain_desc)}\n"

            real_intermediates = []
            for k in range(1, len(nodes)-1):
                if k < len(rels) and rels[k] == "FLOWS_TO":
                        real_intermediates.append(nodes[k]['name'])

        hints_text += "\n"
        return hints_text
    
    def integrate_arch(self, query, retrieved_info, structural_hints=[], divergent_plan=None, base_anchors=[]):
        """
        Integrates all information to generate the final system architecture.

        Args:
            query (str): The user query.
            retrieved_info (dict): Retrieved specific module information.
            structural_hints (list): Structural paths found between components.
            divergent_plan (dict): The structured plan from divergent_planning (optional).
            base_anchors (list): The list of user-defined base anchors.

        Returns:
            dict: The final integrated architecture plan.
        """

        hints_text = self.format_hints(structural_hints)

        # Process Divergent Plan Info
        extension_context = ""
        added_keys = set()
        
        if divergent_plan:
            perspective = divergent_plan.get("perspective", "Standard")
            rationale = divergent_plan.get("rationale", "")
            added_nodes = divergent_plan.get("additional_anchors", [])
            
            if added_nodes:
                added_keys = {n['user_term'] for n in added_nodes}
                
                # Format extension modules significantly for the prompt
                modules_list_str = "\n".join([f"- {n['user_term']}: {n['description']}" for n in added_nodes])
                
                extension_context = f"""
                ## Divergent Extensions (New Sub-systems to Integrate)
                We have identified a valid extension plan to enhance the system. You must integrate these new modules into the Main Pipeline responsibly.
                
                **Plan Perspective**: "{perspective}"
                **Rationale**: {rationale}
                
                **Extension Modules**:
                {modules_list_str}
                
                **Integration Strategy**:
                1. **Sub-System Mounting**: TDepending on their nature, weave these extension modules deeply into the architecture.
                - For the modules that align with the main idea of the plan, design around this new model and restructure the related basic nodes to make them the core functions.
                - Ensure a rich data flow and interconnections. If they inherently need to interact with multiple components (such as memory tracking, sensory input, and user interface), do not limit them to a single "hook point".
                
                2. **Conflict Handling**:
                - If an Extension Module conflicts with a User Module (e.g., "Standard Camera" vs. "Specialized Eye-Tracker"), **Prioritize the User's explicit choice**, but consider using the Extension Module as an *alternative input* or *enhancement*.

                3. **Connection Discipline**:
                - Connect extension modules only where there is a **direct data dependency** — do NOT add connections simply because two modules are "related" or "could benefit from each other".
                - Each extension module should have at most 2 incoming/outgoing connections to the main pipeline.
                """
        else:
             # Fallback if old call signature is used or no plan
             extension_context = "No specific divergent extensions provided."

        slim_retrieved_info = {}
        for anchor, nodes in retrieved_info.items():
            slim_nodes = []
            for n in nodes:
                raw_content = n.get('text', '')
                # Truncate long content — LLM only needs the key idea, not full text
                content = raw_content[:800] + '…' if len(raw_content) > 800 else raw_content
                node_data = {
                    "module": n.get('metadata', {}).get('name', 'Unknown'),
                    "content": content
                }

                # If this is an added node, explicitly preserve its topology
                if anchor in added_keys:
                    raw_topo = n.get('structural_path', None)
                    if not raw_topo:
                        raw_topo = n.get('metadata', {}).get('topology', None)
                    if raw_topo:
                        node_data["structural_context"] = {
                            "upstream": [u['name'] for u in raw_topo.get('upstream', [])],
                            "downstream": [d['name'] for d in raw_topo.get('downstream', [])]
                        }

                slim_nodes.append(node_data)
            slim_retrieved_info[anchor] = slim_nodes

        prompt = f"""
You are a professional HCI system architect. Design a complete pipeline for the user's requirements.

## User Requirements
{query}

## Base Anchors (MANDATORY — include ALL)
{json.dumps(base_anchors, ensure_ascii=False) if base_anchors else "None provided"}

## Language Policy
User-facing text: primarily Chinese; proper nouns/essential technical terms may stay in English.

## Steps
**1. Main Storyline** — define a clear end-to-end functional mainline; write it as `overall_description`.

**2. Define inputs & outputs** - define the system's system-level inputs (external data sources, sensors, user actions) and outputs (what the system delivers to users or downstream systems). Present each as a dedicated input/output module with sub_nodes listing the **specific data types** (e.g., for a harvesting robot: input sub_nodes = "RGB图像流", "机器人位置信号", "任务指令"; output sub_nodes = "采摘进度报告", "异常预警信息"). Use concrete domain-specific names, not generic terms like "输入数据" or "输出结果".

**3. Define Functional Modules** — cover all mainline steps (including all Base Anchors) that connect to the mainline. Target 3–5 TOP-LEVEL modules for the initial overview; you can use sub_nodes to organize internal complexity.
- **Naming (CRITICAL)**: action-oriented, **scenario-specific** — the name must include concrete nouns from the user's domain (e.g., for a harvesting robot system: "采摘任务进度追踪" not "多维进度跟踪"; "果实识别与定位" not "目标检测"; "机器人状态分析" not "多维状态综合评估"). No structural suffixes ("模块/单元/引擎/系统/组件/层"). No paper titles or algorithm names.
- **Data flow clarity**: For each module, clearly distinguish what comes IN (inputs) and what goes OUT (outputs). Input/output modules must list specific data types as sub_nodes (e.g., "RGB图像流", "任务分配指令", not just "数据" or "信息"). Functional modules must describe in `function` field: "接收[具体输入]，执行[具体操作]，输出[具体结果]".
- **Information nodes** (for key data artifacts central to user understanding, e.g. "风险提示", "任务上下文"): name describes the information, not the process. Use sparingly — prefer function-oriented nodes for backend logic.
- **Descriptions**: `function` and `technical_methods` must be detailed and grounded in retrieved info — no fabrication, no vague summaries. Explain HOW methods work and WHY they fit. Always reference the user's specific scenario context.
  - `function`: At least 1 complete sentence. Must clearly state (1) what specific data/input this module receives, (2) what it does to that data, and (3) what output it produces. Never stop mid-sentence or leave the reader guessing.
  - `technical_methods`: **minimum 2 complete sentences**. Name the concrete technique, explain how it works in this domain, and state why it was chosen over alternatives.
  - Apply the same depth requirement to **sub_nodes** — each sub_node's `function` and `technical_methods` must also be at least 2 complete sentences, not one-liners.
- **Subnodes**: Sub_nodes decompose the parent module's responsibility into traceable internal components. They fall into two types — choose the right one:
  - **Type A — Processing Steps**: when the parent handles data through ordered stages (e.g., receive → filter → classify). Each sub_node represents one meaningful step.
  - **Type B — Parallel Data Channels**: when the parent handles multiple simultaneous inputs or outputs (e.g., a multimodal input receiving text, audio, and video). Each sub_node represents one channel or data stream.
  - **Sub_node naming (CRITICAL)**: Sub_node names follow the **same readability-first rule as module names** — they must be instantly understandable to a non-expert, describing *what the system does* in plain, scenario-specific language. Technical terms belong only in the `technical_methods` field, not in the name.
    (a) **Stay in the parent's domain context**: a reader should be able to tell "this sub_node belongs to module X" from the name alone. Include a domain noun from the parent's scenario (e.g., if parent is "障碍感知", sub_nodes should mention 障碍 or related concepts, not abstract terms like "三维重构").
    (b) **Use plain action + domain object**: describe *what happens* in everyday language. No algorithm names, no paper-title phrasing.
    (c) For Type B (parallel channels): name each channel by the specific domain data it carries (e.g., "飞行器姿态信号", "环境深度图像"), not by modality type (e.g., not just "视频流").
    BAD: "实时障碍物三维分布重构与安全航道筛选" (technical paper title, unreadable at a glance)
    BAD: "RGB图像流" (too generic — no domain context)
    GOOD (Type A): "障碍分布预测" + "可飞行路径筛选" (plain, domain-grounded, readable)
    GOOD (Type B): "飞行器IMU姿态数据" + "环境障碍深度图像" (specific domain channels)
  - Sub_node `function` must follow the same IPO format as top-level: "接收[具体输入]，执行[具体操作]，输出[具体结果]". Minimum 1 complete sentence. Do NOT use vague one-liners like "负责处理数据" or "用于优化性能".
  - Sub_node `technical_methods`: minimum 2 complete sentences. Name the concrete technique, explain how it applies specifically to THIS sub_node's domain context (not a generic description), and state a specific constraint or trigger condition under which it activates.
- Integrate all divergent-plan nodes meaningfully.

**4. Connect the Flow**
- Build a clear end-to-end flow. Each module needs ONLY its MINIMUN necessary connections. Do NOT add links indicating "related", "benificial", or "contextal linked".
- **Hard limit**: each module may have at most **2 outgoing** and **2 incoming** ports total. If you exceed this, remove the weakest edge.
- **Feedback / cross-connections**: allow at most **1** feedback loop in the entire diagram, and only when it represents a concrete control signal (e.g., error correction, adaptive calibration). Omit all other secondary edges.
- Default to module-level connections; use subnode-level only when the subnode is the true locus of computation and hiding it would obscure a key mechanism.
- `source_mod` / `target_mod` must reference names defined in `module_details` — no phantom nodes.
- Merge parallel edges between the same pair of nodes. Preserve literature-validated flow order where applicable.

**5. Final Check**
- Remove only true duplicates (same function AND same data flow endpoints).
- Reconnect isolated nodes if possible; remove only if unreachable and content-free.

## Reference Material
**Retrieved Modules** — ground `function`/`technical_methods` in these; abstract away paper names; merge similar nodes.
**Structural Paths** — treat as ground truth for data-flow order.

{extension_context}

Retrieved Modules: {json.dumps(slim_retrieved_info, ensure_ascii=False)}

Structural Paths: {hints_text}

## Output (JSON)
Use compact string format for `ports` to save space:
- `incoming`: "SourceMod->edge_label" or "SourceMod.srcSubNode->edge_label"
- `outgoing`: "TargetMod->edge_label" or "TargetMod.tgtSubNode->edge_label"
- `internal_flow`: "SubA->SubB->edge_label"

**Edge Label Guidelines**:
- For **forward flow edges** (normal progression): describe the data/information being passed (e.g., "处理结果", "用户输入", "分析报告")
- For **feedback/loop edges** (returning to earlier stages): describe the trigger condition or control signal (e.g., "检测到异常时", "优先级变化", "需要重新评估", "质量不达标")
- Keep labels concise (2-6 characters ideal for Chinese, 3-8 words for English)
- Avoid generic labels like "数据" or "信息" — be specific about what flows or when it triggers

{{
    "overall_description": "A plan description for less than 100 words, the structure is 'With [the core innovation of perspective] as the core design concept, this system is based on [core processing mechanism], [how to deal with the core challenges of the user scenarios]. [key functional modules and primary path of the data flow].'",
    "module_details": [
        {{
            "name": "module name",
            "brief_description": "one sentence, scenario-specific, no jargon",
            "function": "what specific inputs this module receives, what operation it performs on them, and what output it produces",
            "technical_methods": "name the concrete technique, explain HOW it processes data in this domain, and WHY it was chosen",
            "role": "input|output|processing|data",
            "references": "exact names from Retrieved Modules or 'None'",
            "sub_nodes": [{{"name":"plain readable name in parent's domain context — no algorithm names, no paper titles","function":"≥1 sentence: 接收[具体输入]，执行[具体操作]，输出[具体结果]","technical_methods":"≥2 sentences: name technique + how it works in this domain + activation condition"}}],
            "ports": {{ // MINIMUN NECESSARY CONNECTIONS
                "incoming": ["ModA->分析结果", "ModB.SubX->控制信号"], 
                "outgoing": ["ModC->处理后数据", "ModA->检测到异常时"],
                "internal_flow": ["SubA->SubB->中间结果"]
            }}
        }}
    ]
}}
"""
        prompt_chars = len(prompt)
        print(f"[integrate_arch] prompt size: {prompt_chars} chars (~{prompt_chars//4} tokens est)")
        for anchor, nodes in slim_retrieved_info.items():
            total_content = sum(len(n.get('content','')) for n in nodes)
            print(f"  anchor '{anchor}': {len(nodes)} nodes, {total_content} content chars")
        try:
            response = self.client.chat.completions.create(
                # model="gpt-4o-2024-11-20",
                model = CHAT_MODEL,

                messages=[{"role": "user", "content": prompt}],
                temperature=0.8,
                response_format={"type": "json_object"},
            ).choices[0].message.content
        except Exception as e:
            print(f"Error: {e}")
            import time
            for _retry in range(2):
                time.sleep(3 * (_retry + 1))
                try:
                    print(f"Retrying integrate_arch (attempt {_retry + 2})...")
                    response = self.client.chat.completions.create(
                        model=CHAT_MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.8,
                        response_format={"type": "json_object"},
                    ).choices[0].message.content
                    break
                except Exception as e2:
                    print(f"Error (retry {_retry + 2}): {e2}")
                    response = None
            else:
                return None
        if not response:
            return None
        # Strip // inline comments that LLMs sometimes insert (causes json.loads to fail)
        import re as _re
        response = _re.sub(r'//[^\n"]*', '', response)
        try:
            json.loads(response)  # validate before returning
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON response: {e}")
            return None
        print(response)
        return _expand_compact_ports(response)

    def refine_arch(self, original_query, current_arch, error_report):
        """
        Asks the LLM to fix the architecture based on the error report from ConflictSolver.
        """
        print(f"🔧 Integrator: Refining architecture based on errors...")
        prompt = f"""
        You are a System Architect. You previously generated a system design JSON, but it failed the integrity check.
        
        ## User Requirements
        {original_query}

        ## Current (Flawed) Design
        {current_arch}

        ## Error Report (Why it is invalid)
        {error_report}

        ## Task
        Fix the errors listed in the report. 
        1. If a node is missing (dangling edge), define it.
        2. If a node is isolated, connect it or remove it if truly unnecessary.
        3. Ensuring all 'source_mod' and 'target_mod' in ports refer to valid keys (or 'name' fields if using list) in 'module_details'.

        **CRITICAL REQUIREMENT:** 
        `module_details` MUST be a LIST containing the FULL, COMPLETE architecture with ALL nodes (both modified and unmodified) as objects. Do NOT only output the changed nodes. Failure to output unmodified nodes will break the system.

        ## Language Policy
        - Preserve architecture structure and node/link consistency exactly.
        - Keep user-facing textual fields primarily in Chinese.
        - Proper nouns and necessary technical terms may remain in English.

        Return the FULLY CORRECTED JSON object.
        """
        import time
        for _attempt in range(3):
            try:
                response = self.client.chat.completions.create(
                    model=CHAT_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                    response_format={"type": "json_object"},
                ).choices[0].message.content
                return response
            except Exception as e:
                print(f"Error checking integrity (attempt {_attempt+1}): {e}")
                if _attempt < 2:
                    time.sleep(3 * (_attempt + 1))
        return current_arch

    def collect_references(self, arch_plan, retrieved_info):
        """
        Organize used references and unused 'explorable' references from retrieved info.
        Args:
            arch_plan (dict): The final architecture plan (JSON).
            retrieved_info (dict): The raw retrieval dictionary {anchor: [nodes]}.
        Returns: 
            dict: { "used": { "Module": [evidence] }, "explorable": [evidence] }
        """
        if not arch_plan or not isinstance(arch_plan, dict) or "module_details" not in arch_plan:
             return {"used": {}, "explorable": []}

        # 1. Extract Used Reference Names from Plan
        # Map: RefName -> ModuleUserTerm
        used_ref_map = {} 
        
        module_details = arch_plan["module_details"]
        vals = module_details.values() if isinstance(module_details, dict) else module_details
        
        for mod in vals:
            m_name = mod.get("name", "Unknown")
            ref_str = mod.get("references", "")
            if ref_str and ref_str.lower() != "none":
                # Split by comma
                refs = [r.strip() for r in ref_str.split(",")]
                for r in refs:
                    if r: used_ref_map[r.lower()] = m_name

        # 2. Iterate Retrieved Info
        used_output = {}
        explorable_output = []
        
        seen_ids = set() 

        for anchor, nodes in retrieved_info.items():
            for node_data in nodes:
                n_id = node_data.get('id', 'unknown')
                if n_id in seen_ids: continue
                seen_ids.add(n_id)
                
                n_name = node_data.get('metadata', {}).get('name', '')
                if not n_name and 'node' in node_data:
                     n_name = node_data['node'].metadata.get('name', '')
                     
                
                n_text = node_data.get('text', '')
                if not n_text and 'node' in node_data:
                    n_text = node_data['node'].text
                
                n_source = node_data.get('metadata', {}).get('source', '')
                if not n_source:
                    n_source = node_data.get('metadata', {}).get('topology', {}).get('source_file', '')
                
                if not n_name: n_name = "Unknown Source"

                # Check if this node is in used_ref_map
                matched_module = None
                for ref_key, mod_term in used_ref_map.items():
                    if ref_key in n_name.lower() or n_name.lower() in ref_key:
                        matched_module = mod_term
                        break
                
                entry = {
                    "name": n_name,
                    "text": n_text,
                    "source": n_source,
                    "source_anchor": anchor
                }
                
                if matched_module:
                    if matched_module not in used_output:
                        used_output[matched_module] = []
                    used_output[matched_module].append(entry)
                else:
                    explorable_output.append(entry)
                    
        return {"used": used_output, "explorable": explorable_output}

class EditorAgent:
    def __init__(self, client):
        self.client = client
        # self.model = "gpt-4o-2024-11-20"
        self.model = CHAT_MODEL

    def edit_plan(self, current_plan, user_instruction, history_summary, retriever, referenced_modules=None):
        """
        Analyzes the user's instruction, retrieves necessary information, and revises the architecture.
        Maintains modification history for context.
        """
        print(f"🧠 Editor: Processing modification request with lineage history...")
        
        # 1. Prepare Tools
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "retrieve_knowledge",
                    "description": "Retrieve domain knowledge or technical details when the user's request involves specific concepts, technologies, or complex workflows that are not fully understood or need external validation.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The search query to find relevant modules or patterns."
                            }
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "retrieve_topology",
                    "description": "Retrieve structural connection paths between two modules from the knowledge graph. Use this when you need to understand how two components are typically connected in literature, or when you are adding/reconnecting a module and need to know its upstream/downstream neighbors.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "source": {
                                "type": "string",
                                "description": "Name or description of the source module."
                            },
                            "target": {
                                "type": "string",
                                "description": "Name or description of the target module."
                            }
                        },
                        "required": ["source", "target"]
                    }
                }
            }
        ]

        # 2. Prepare Context & History
        history_text = "No previous modifications."
        if history_summary:
            history_text = "## Modification History (Chronological)\n"
            for item in history_summary:
                if item['type'] == 'Initial Plan':
                     history_text += f"- Step {item['step']} [Initial]: {item['perspective']} - {item['result_description']}\n"
                else:
                     history_text += f"- Step {item['step']} [Mod]: User asked '{item['user_instruction']}' -> Result: {item['result_description']}\n"

        # Ensure current plan is a dict
        if isinstance(current_plan, str):
            try:
                current_plan = json.loads(current_plan)
            except:
                pass

        # Slim down the plan for the editor prompt: drop heavy fields not needed for decision-making
        def _slim_plan(plan):
            if not isinstance(plan, dict):
                return plan
            slim = {k: v for k, v in plan.items() if k != "module_details"}
            mds = plan.get("module_details", [])
            if isinstance(mds, dict):
                mds = list(mds.values())
            slim_mds = []
            for m in mds:
                slim_mds.append({k: m[k] for k in ["name", "brief_description", "role", "ports", "sub_nodes"] if k in m})
            slim["module_details"] = slim_mds
            return slim

        slim_plan = _slim_plan(current_plan)

        # Build referenced modules block before f-string (avoid nested f-string syntax error)
        if referenced_modules:
            ref_lines = "\n".join(
                f"- [{m.get('plan_name', 'Other Plan')}] {m.get('module_name', '')}:\n  {json.dumps(m.get('module_data', {}), ensure_ascii=False)}"
                for m in referenced_modules
            )
            referenced_modules_section = f"""
        ## Referenced Modules from Other Plans (User-Selected Context)
        The user has explicitly referenced the following modules from alternative design plans as inspiration or comparison. When addressing the user's instruction, consider these modules — you may borrow their structure, logic, or sub-nodes where appropriate, while adapting them to fit the current architecture's naming conventions and domain context.
        {ref_lines}
                """
        else:
            referenced_modules_section = ""

        system_prompt = f"""
        You are an expert System Architect. You are collaborating with a user to modify a system architecture design.
        
        ## Your Capabilities
        1. **Analyze**: Understand the user's intent and the current architecture.
        2. **Retrieve Knowledge**: If the user asks for something that needs specific knowledge or technical details (e.g., "Add a Kafka stream", "Use a Transformer model"), use the `retrieve_knowledge` tool to get technical details.
        3. **Retrieve Topology**: If you are adding, reconnecting, or repositioning a module and need to know how it typically connects to other components in literature, use the `retrieve_topology` tool with the source and target module names. This returns validated structural paths from the knowledge graph.
        4. **Modify**: Update the architecture JSON to reflect the changes.
        
        ## Evolution Context
        This is the current state of the plan. Here is the history of how it evolved:
        {history_text}
        
        ## Current Architecture
        {json.dumps(slim_plan, ensure_ascii=False)}
        {referenced_modules_section}

        ## Task
        The user has provided an instruction. You must:
        1. Analyze the instruction in context of the history (avoid repeating undone changes, or building on top of recent changes).
        2. If you need external knowledge (e.g., technical specs, similar modules), call `retrieve_knowledge`.
        3. If you are adding or reconnecting a module and need to know its typical upstream/downstream neighbors, call `retrieve_topology` with the relevant source and target names to get literature-validated connection paths.
        4. Decide the response mode:
           - plan_update: update the architecture JSON
           - direct_answer: answer the user without changing the plan
           - evidence_answer: answer with evidence and citations without changing the plan
           - plan_explain: explain the current plan without changing it
        4. Output a FINAL JSON response matching the required format below.

        ## Language Policy
        - Understand the user instruction as-is (Chinese or English) without changing intent.
        - Do not alter plan structure rules or retrieval behavior because of language choice.
        - In final output, user-facing textual fields should be primarily in Chinese.
        - Proper nouns and indispensable technical terms may remain in English.

        **Semantics Rule for Module and Subnodes**:
            - **Naming (CRITICAL)**: action-oriented, **scenario-specific** — include concrete nouns from the user's domain. The name must be immediately understandable to a non-expert in the specific application context. No structural suffixes ("模块/单元/引擎/系统/组件/层"). No paper titles or algorithm names. Technical terms belong only in `technical_methods`, not in the name. Examples: "进度跟踪模块"→"采摘任务进度追踪"; "多维状态综合评估"→"机器人状态分析评估"; "沉浸式虚拟仿真"→"AR仓库场景映射"
            - **Sub_node naming (CRITICAL)**: Sub_nodes follow the same readability-first rule as module names. A sub_node's name must make its parent module's domain context recognizable at a glance, WITHOUT reading the parent name. Two sub_node types:
              (a) **Processing steps**: name = plain domain action + domain object (e.g., "障碍分布预测", "飞行通道可行性判断"). BAD: "三维点云重构" (reads as standalone paper title).
              (b) **Parallel data channels**: name = specific domain data type (e.g., "飞行器IMU姿态数据", "环境障碍深度图像"). BAD: "RGB视频流" (no domain context).
              In both cases: no algorithm names, no paper-title phrasing, no generic nouns without domain qualification.
            - **function field**: explicitly state (1) what data/input this module receives, (2) what specific operation it performs, (3) what output it produces. Do NOT use vague phrases like "进行分析" or "实现决策" — say exactly WHAT is analyzed, WHAT decision is made.
            - Ensure the added nodes from the divergent plans are integrated meaningfully.
            - **Provide detailed descriptions for both `function` and `technical_methods` from the retrieved information BUT DO NOT FABRICATE.** You must explicitly articulate the module's specific role, core responsibilities, and crucial importance within the overall system. Explain exactly HOW the technical methods work, process data, and why they were chosen, avoiding brief or vague summaries.
            
        **Connections**:
            - Build a clear primary end-to-end flow with MINIMUN NECESSARY connections.
            - Hard limit: at most **2 outgoing** and **2 incoming** ports per module. At most **1** feedback loop in the entire diagram.


        ## Modification Rules
        1. **Locality**: Only change what is requested.
           - In single-node mode, modify only the target module, its `sub_nodes`, and minimally required adjacent edges.
           - Keep all other modules unchanged unless a strict consistency fix is necessary.
        2. **Preservation**: Keep existing modules unless asked to remove them.
        3. **Consistency**: Ensure the graph remains connected and logical.
        4. **Integrity**: Ensure all `source_mod` and `target_mod` in ports refer to valid keys in `module_details`.
        5. **Naming Rule**: When adding or renaming nodes, use concise **scenario-specific** names that describe *what the node does in this specific application context*. Include domain nouns from the user's system (e.g., "采摘", "果园", "机器人" for a harvesting robot system). Avoid generic structural suffixes like "模块", "单元", "矩阵", "引擎", "系统", "组件", "层", "网络". For example: "优先级解释" not "优先级解释展示单元"; "采摘任务动态调度" not "动态优先级与资源决策模块"; "果实特征提取" not "任务特征抽取单元".
        
        
        ## Final Output Format
        If you choose plan_update, output:
        {{
            "output_type": "plan_update",
            "modification_intent": "A concise summary of what you changed (e.g., 'Added Authentication Module and connected it to User Interface')",
            "revised_plan": {{
                "overall_description": "The overall description of the ENTIRE revised system architecture. Update the original description to reflect your changes, but DO NOT just write your modification intent here.",
                "module_details": [
                    {{
                        "name": "NewOrModifiedModuleA",
                        "change_type": "added | modified",
                        "brief_description": "...",
                        "function": "Detailed explanation of the module's function, its core responsibilities, and its crucial role and importance within the overall system architecture.",
                        "technical_methods": "Detailed description of the specific algorithms, models, or technical methods used, including HOW they process data and why they are selected. You MUST abstract away the original paper context.",
                        "role": "choose from ['input', 'output', 'processing', 'data']",
                        "sub_nodes": [],
                        "ports": {{}}
                    }},
                    {{
                        "name": "ExistingModuleWhosePortsChanged",
                        "change_type": "ports_only",
                        "ports": {{}}
                    }},
                    {{
                        "name": "UnchangedModuleC",
                        "change_type": "unchanged"
                    }}
                ]
            }}
        }}

        If you choose direct_answer, evidence_answer, or plan_explain, output:
        {{
            "output_type": "direct_answer | evidence_answer | plan_explain",
            "answer": {{
                "text": "Your response to the user.",
                "citations": [
                    {{
                        "title": "Source title or module name",
                        "snippet": "Short evidence snippet",
                        "source": "Origin if available"
                    }}
                ]
            }}
        }}

        **CRITICAL REQUIREMENT:**
        1. `overall_description` MUST describe the full, comprehensive system workflow after your changes.
        2. `module_details` MUST be a LIST containing ALL nodes using the diff format above:
           - Newly added or content-modified nodes: include ALL fields with `"change_type": "added"` or `"change_type": "modified"`.
           - Nodes whose only change is connection rewiring: include ONLY `name`, `"change_type": "ports_only"`, and the new `ports` object.
           - Completely unmodified nodes: include ONLY `name` and `"change_type": "unchanged"`. Do NOT omit them.
        3. When adding a new module that connects to existing modules, you MUST also output `ports_only` entries for those existing modules to reflect the new connections.
        4. For non-plan_update modes, do NOT output revised_plan and do NOT alter the plan.
        """

        messages = [{"role": "system", "content": system_prompt}]
        messages.append({"role": "user", "content": user_instruction})

        # 3. Execution Loop
        max_steps = 5
        current_step = 0
        
        while current_step < max_steps:
            current_step += 1
            
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    tools=tools,
                    tool_choice="auto",
                    response_format={"type": "json_object"}
                )
                
                msg = response.choices[0].message
                
                # Check for tool calls
                if msg.tool_calls:
                    messages.append(msg) # Add assistant's message with tool calls
                    
                    for tool_call in msg.tool_calls:
                        if tool_call.function.name == "retrieve_knowledge":
                            args = json.loads(tool_call.function.arguments)
                            query = args.get("query")
                            print(f"🔍 Editor calling tool: retrieve_knowledge('{query}')")

                            # Execute retrieval using the passed retriever instance
                            # We'll use a simplified retrieval wrapper here
                            # Create fake anchors for the retriever
                            search_anchors = [{"user_term": query, "description": "User requested enhancement"}]
                            retrieved_map = retriever.retrieve_for_module(search_anchors, top_k=3, include_topology=True)

                            # Format results
                            context_text = f"### Retrieval Results for '{query}':\n"
                            found_any = False
                            for term, nodes in retrieved_map.items():
                                for n in nodes:
                                    found_any = True
                                    title = n.node.metadata.get("name", "Unknown")
                                    source = n.node.metadata.get("source", "")
                                    snippet = n.node.text[:500]
                                    context_text += f"- Title: {title}\n"
                                    context_text += f"  Snippet: {snippet}...\n"
                                    context_text += f"  Source: {source}\n"

                            if not found_any:
                                context_text += "No relevant modules found."

                            messages.append({
                                "tool_call_id": tool_call.id,
                                "role": "tool",
                                "name": "retrieve_knowledge",
                                "content": context_text
                            })

                        elif tool_call.function.name == "retrieve_topology":
                            args = json.loads(tool_call.function.arguments)
                            source = args.get("source")
                            target = args.get("target")
                            print(f"🔍 Editor calling tool: retrieve_topology('{source}' -> '{target}')")

                            # Execute structural path retrieval
                            user_relations = [{"source": source, "target": target, "type": "FLOWS_TO"}]
                            structural_paths = retriever.retrieve_structure_paths(user_relations)

                            # Format results similar to IntegratorAgent.format_hints
                            context_text = f"### Structural Paths for '{source}' -> '{target}':\n"
                            if structural_paths:
                                for i, path in enumerate(structural_paths):
                                    nodes = path.get('path_nodes', [])
                                    rels = path.get('relations', [])
                                    rel_props = path.get('rel_props', [])

                                    chain_desc = []
                                    if nodes:
                                        start_node_name = nodes[0].get('name', 'Unknown')
                                        chain_desc.append(f"[{start_node_name}]")

                                        for j, rel in enumerate(rels):
                                            if j + 1 < len(nodes):
                                                target_node = nodes[j+1].get('name', 'Unknown')
                                                func = nodes[j+1].get('function', '')
                                                if func:
                                                    target_node += f" ({func[:100]}...)"

                                                data_content = ""
                                                if j < len(rel_props) and rel_props[j] and 'edge_label' in rel_props[j]:
                                                    lbl = rel_props[j]['edge_label']
                                                    if lbl and lbl != "null":
                                                        data_content = f": {lbl}"

                                                if rel == "FLOWS_TO":
                                                    chain_desc.append(f" --({data_content})--> [{target_node}]")
                                                else:
                                                    chain_desc.append(f" --({rel}{data_content})--> [{target_node}]")

                                    context_text += f"  Path {i+1}: {''.join(chain_desc)}\n"
                            else:
                                context_text += "No structural paths found in literature. You may need to infer the connection based on domain knowledge."

                            messages.append({
                                "tool_call_id": tool_call.id,
                                "role": "tool",
                                "name": "retrieve_topology",
                                "content": context_text
                            })
                    
                    # Continue loop to let model use the info
                    continue
                
                # If no tool calls, this is the final response
                content = msg.content
                try:
                    import re
                    # Try direct JSON parsing
                    try:
                        result = json.loads(content)
                        return self._reflect(result, current_plan, user_instruction)
                    except json.JSONDecodeError:
                        print(f"Failed to parse JSON directly. Attempting regex extraction...")
                        # Fallback: extract JSON from markdown code blocks
                        json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', content, re.DOTALL)
                        if json_match:
                            try:
                                result = json.loads(json_match.group(1))
                                return self._reflect(result, current_plan, user_instruction)
                            except json.JSONDecodeError:
                                pass

                        # Fallback: extract outermost JSON object
                        json_match = re.search(r'(\{.*\})', content, re.DOTALL)
                        if json_match:
                            try:
                                result = json.loads(json_match.group(1))
                                return self._reflect(result, current_plan, user_instruction)
                            except json.JSONDecodeError:
                                pass

                        print(f"Error parsing final JSON even after extraction. Retrying...")
                        # Append a user message asking to fix the JSON format
                        messages.append({"role": "assistant", "content": content})
                        messages.append({"role": "user", "content": "The JSON you provided is invalid. Please ensure it is strictly valid JSON without any // comments, trailing commas, or markdown outside the valid JSON object format."})
                        continue

                except Exception as e:
                    print(f"Unexpected error when parsing content: {e}")
                    continue

            except Exception as e:
                print(f"Error in edit_plan loop: {e}")
                break

        return None

    def _reflect(self, result, original_plan, user_instruction):
        """
        Post-edit reflection: merge diff output back into the full plan.
        Nodes with change_type='unchanged' are restored from original_plan.
        Nodes with change_type='ports_only' get only their ports updated.
        Nodes with change_type='added'/'modified' are taken as-is.
        Also checks for silently dropped nodes (missing change_type entirely).
        """
        if not isinstance(result, dict) or result.get("output_type") != "plan_update":
            return result

        revised_plan = result.get("revised_plan")
        if not revised_plan:
            return result

        def get_module_list(plan):
            if not isinstance(plan, dict):
                return []
            md = plan.get("module_details", [])
            if isinstance(md, list):
                return md
            if isinstance(md, dict):
                return list(md.values())
            return []

        orig_modules = get_module_list(original_plan if isinstance(original_plan, dict) else {})
        orig_lookup  = {m.get("name", ""): m for m in orig_modules if m.get("name")}
        diff_list    = get_module_list(revised_plan)

        # Check if diff format is being used (any entry has change_type)
        uses_diff = any("change_type" in m for m in diff_list if isinstance(m, dict))

        if uses_diff:
            merged = []
            diff_names = set()
            for entry in diff_list:
                if not isinstance(entry, dict):
                    continue
                name = entry.get("name", "")
                if not name:
                    continue
                diff_names.add(name)
                ct = entry.get("change_type", "modified")

                if ct == "unchanged":
                    # Restore full node from original
                    if name in orig_lookup:
                        merged.append(orig_lookup[name])
                    else:
                        print(f"⚠️  Reflection: unchanged node '{name}' not found in original, skipping.")
                elif ct == "ports_only":
                    # Take original node but overwrite ports
                    if name in orig_lookup:
                        restored = dict(orig_lookup[name])
                        restored["ports"] = entry.get("ports", restored.get("ports", {}))
                        merged.append(restored)
                    else:
                        # New node with only ports? Keep as-is (shouldn't happen)
                        merged.append(entry)
                else:
                    # added or modified: use as-is
                    merged.append(entry)

            # Restore any nodes completely missing from diff (silently dropped)
            instr_lower = user_instruction.lower()
            for name, orig_node in orig_lookup.items():
                if name not in diff_names and name.lower() not in instr_lower:
                    print(f"⚠️  Reflection: silently dropped node '{name}', restoring.")
                    merged.append(orig_node)

            revised_plan["module_details"] = merged
            result["revised_plan"] = revised_plan
            print(f"✅ Reflection (diff mode): merged {len(merged)} nodes total.")
            return result

        # Legacy full-output mode: check for silently dropped nodes
        revised_list  = diff_list
        revised_names = {m.get("name", "") for m in revised_list if m.get("name")}
        dropped       = set(orig_lookup.keys()) - revised_names

        if not dropped:
            print("✅ Reflection: No nodes were silently dropped.")
            return result

        instr_lower = user_instruction.lower()
        to_restore = [name for name in dropped if name.lower() not in instr_lower]
        truly_dropped = dropped - set(to_restore)

        if truly_dropped:
            print(f"✅ Reflection: {truly_dropped} appear intentionally removed (mentioned in instruction).")

        if not to_restore:
            print("✅ Reflection: All dropped nodes were legitimately removed.")
            return result

        print(f"⚠️  Reflection: Restoring {len(to_restore)} silently dropped node(s): {to_restore}")
        for name in to_restore:
            revised_list.append(orig_lookup[name])

        revised_plan["module_details"] = revised_list
        result["revised_plan"] = revised_plan
        return result


class ConflictSolver:
    def __init__(self):
        pass

    @staticmethod
    def _normalize(arch_json_str):
        """Parse and normalize module_details to a dict keyed by name."""
        data = json.loads(arch_json_str) if isinstance(arch_json_str, str) else arch_json_str
        md = data.get("module_details", {})
        if isinstance(md, list):
            md = {m.get("name", f"__unknown_{i}"): m for i, m in enumerate(md)}
        return data, md

    @staticmethod
    def _sub_ids(m_info):
        """Return the set of sub-node names declared in a module."""
        return {s.get("name") for s in m_info.get("sub_nodes", []) if s.get("name")}

    @staticmethod
    def _edge_key(src_mod, tgt_mod, src_node, tgt_node):
        """Canonical dedup key for an edge (ignores label)."""
        return (src_mod or "", tgt_mod or "", src_node or "", tgt_node or "")

    def detect_conflicts(self, arch_json_str):
        """
        Inspect the JSON for hard errors and soft warnings.

        Hard errors (is_valid=False):
          - Dangling edge: invalid module reference in incoming/outgoing
          - Invalid sub-node reference in internal_flow, connects_to_internal_node,
            originates_from_internal_node, or target_node
          - Truly isolated module: no connections AND no meaningful content

        Soft warnings (printed only, do not affect is_valid):
          - Sub-node not referenced by any port
          - Duplicate edges
        """
        try:
            data, module_details = self._normalize(arch_json_str)
        except Exception as e:
            return False, f"CRITICAL: Invalid JSON format. ({e})"

        if not module_details:
            return False, "CRITICAL: 'module_details' field is missing or empty."

        hard_issues = []
        valid_mod_ids = set(module_details.keys())
        connected_modules = set()

        for m_id, m_info in module_details.items():
            ports = m_info.get("ports", {})
            sub_ids = self._sub_ids(m_info)

            # ── Incoming ────────────────────────────────────────────────────
            for edge in ports.get("incoming", []):
                src = edge.get("source_mod")
                if src and src not in valid_mod_ids:
                    hard_issues.append(
                        f"- Dangling incoming edge: Module '{m_id}' references undefined source '{src}'."
                    )
                else:
                    connected_modules.update(filter(None, [m_id, src]))
                cti = edge.get("connects_to_internal_node")
                if cti and cti not in sub_ids:
                    hard_issues.append(
                        f"- Invalid sub-node ref: 'connects_to_internal_node'='{cti}' in '{m_id}' "
                        f"not found in its sub_nodes."
                    )

            # ── Outgoing ────────────────────────────────────────────────────
            for edge in ports.get("outgoing", []):
                tgt = edge.get("target_mod")
                if tgt and tgt not in valid_mod_ids:
                    hard_issues.append(
                        f"- Dangling outgoing edge: Module '{m_id}' references undefined target '{tgt}'."
                    )
                else:
                    connected_modules.update(filter(None, [m_id, tgt]))
                ofin = edge.get("originates_from_internal_node")
                if ofin and ofin not in sub_ids:
                    hard_issues.append(
                        f"- Invalid sub-node ref: 'originates_from_internal_node'='{ofin}' in '{m_id}' "
                        f"not found in its sub_nodes."
                    )
                tgt_node = edge.get("target_node")
                if tgt_node and tgt in valid_mod_ids:
                    tgt_subs = self._sub_ids(module_details[tgt])
                    if tgt_subs and tgt_node not in tgt_subs:
                        hard_issues.append(
                            f"- Invalid sub-node ref: 'target_node'='{tgt_node}' in outgoing of '{m_id}' "
                            f"not found in target module '{tgt}'."
                        )

            # ── Internal flow ───────────────────────────────────────────────
            for flow in ports.get("internal_flow", []):
                for field in ("source_node", "target_node"):
                    node_ref = flow.get(field)
                    if node_ref and node_ref not in sub_ids:
                        hard_issues.append(
                            f"- Invalid internal_flow ref: '{field}'='{node_ref}' in '{m_id}' "
                            f"not found in its sub_nodes."
                        )

        # ── Isolated modules ────────────────────────────────────────────────
        if len(valid_mod_ids) > 1:
            for m_id, m_info in module_details.items():
                if m_id not in connected_modules:
                    has_content = bool(
                        m_info.get("function") or
                        m_info.get("brief_description") or
                        m_info.get("sub_nodes")
                    )
                    if has_content:
                        print(f"  ⚠️  Soft warning: '{m_id}' has no connections but has content — needs review.")
                    else:
                        hard_issues.append(
                            f"- Isolated empty module: '{m_id}' has no connections and no meaningful content."
                        )

        # ── Soft: unreferenced sub-nodes (warn only) ────────────────────────
        for m_id, m_info in module_details.items():
            sub_ids = self._sub_ids(m_info)
            if not sub_ids:
                continue
            ports = m_info.get("ports", {})
            referenced = set()
            for edge in ports.get("incoming", []):
                if edge.get("connects_to_internal_node"):
                    referenced.add(edge["connects_to_internal_node"])
            for edge in ports.get("outgoing", []):
                if edge.get("originates_from_internal_node"):
                    referenced.add(edge["originates_from_internal_node"])
            for flow in ports.get("internal_flow", []):
                referenced.update(filter(None, [flow.get("source_node"), flow.get("target_node")]))
            for sub_name in sub_ids - referenced:
                print(f"  ⚠️  Soft warning: sub-node '{sub_name}' in '{m_id}' not referenced by any port.")

        if not hard_issues:
            return True, "No conflicts found."
        return False, "\n".join(hard_issues)

    def resolve(self, arch_json_str):
        """
        Hard-clean the architecture JSON:
          1. Remove dangling edges (invalid module refs).
          2. Clear invalid sub-node refs in connects_to / originates_from /
             target_node / internal_flow (set to None rather than crashing).
          3. Deduplicate exact-duplicate edges (same src_mod, tgt_mod,
             src_node, tgt_node — ignoring label).
          4. Remove modules that are both unconnected AND content-empty.
          5. Output module_details as a list.
        """
        try:
            data, module_details = self._normalize(arch_json_str)
        except Exception:
            print("❌ ConflictSolver: Invalid JSON string.")
            return arch_json_str

        if not module_details:
            return json.dumps(arch_json_str if isinstance(arch_json_str, dict) else {})

        print("🕵️ ConflictSolver: Resolving topology...")

        # Clean malformed sub_nodes (remove 'ports' field if present)
        for m_info in module_details.values():
            sub_nodes = m_info.get("sub_nodes", [])
            for sub in sub_nodes:
                if "ports" in sub:
                    del sub["ports"]
                    print(f"  Cleaned invalid 'ports' field from sub_node '{sub.get('name')}'")

        valid_mod_ids = set(module_details.keys())
        sub_id_map = {m_id: self._sub_ids(m_info) for m_id, m_info in module_details.items()}
        connected_modules = set()
        removed_edges = 0
        deduped = 0

        for m_id, m_info in module_details.items():
            ports = m_info.get("ports", {})
            sub_ids = sub_id_map[m_id]

            # ── Incoming ────────────────────────────────────────────────────
            new_incoming, seen = [], set()
            for edge in ports.get("incoming", []):
                src = edge.get("source_mod")
                if src and src not in valid_mod_ids:
                    print(f"  Removed dangling incoming: '{src}' → '{m_id}'")
                    removed_edges += 1
                    continue
                cti = edge.get("connects_to_internal_node")
                if cti and cti not in sub_ids:
                    print(f"  Cleared invalid connects_to_internal_node='{cti}' in '{m_id}'")
                    edge = {**edge, "connects_to_internal_node": None}
                key = self._edge_key(src, m_id, edge.get("source_node"), edge.get("connects_to_internal_node"))
                if key in seen:
                    deduped += 1
                    continue
                seen.add(key)
                new_incoming.append(edge)
                connected_modules.update(filter(None, [m_id, src]))

            # ── Outgoing ────────────────────────────────────────────────────
            new_outgoing, seen = [], set()
            for edge in ports.get("outgoing", []):
                tgt = edge.get("target_mod")
                if tgt and tgt not in valid_mod_ids:
                    print(f"  Removed dangling outgoing: '{m_id}' → '{tgt}'")
                    removed_edges += 1
                    continue
                ofin = edge.get("originates_from_internal_node")
                if ofin and ofin not in sub_ids:
                    print(f"  Cleared invalid originates_from_internal_node='{ofin}' in '{m_id}'")
                    edge = {**edge, "originates_from_internal_node": None}
                tgt_node = edge.get("target_node")
                if tgt_node and tgt in valid_mod_ids:
                    tgt_subs = sub_id_map.get(tgt, set())
                    if tgt_subs and tgt_node not in tgt_subs:
                        print(f"  Cleared invalid target_node='{tgt_node}' in outgoing of '{m_id}'")
                        edge = {**edge, "target_node": None}
                key = self._edge_key(m_id, tgt, edge.get("originates_from_internal_node"), edge.get("target_node"))
                if key in seen:
                    deduped += 1
                    continue
                seen.add(key)
                new_outgoing.append(edge)
                connected_modules.update(filter(None, [m_id, tgt]))

            # ── Internal flow ───────────────────────────────────────────────
            new_internal, seen = [], set()
            for flow in ports.get("internal_flow", []):
                src_n, tgt_n = flow.get("source_node"), flow.get("target_node")
                if (src_n and src_n not in sub_ids) or (tgt_n and tgt_n not in sub_ids):
                    print(f"  Removed invalid internal_flow '{src_n}→{tgt_n}' in '{m_id}'")
                    removed_edges += 1
                    continue
                key = (src_n or "", tgt_n or "")
                if key in seen:
                    deduped += 1
                    continue
                seen.add(key)
                new_internal.append(flow)

            m_info["ports"] = {
                "incoming": new_incoming,
                "outgoing": new_outgoing,
                "internal_flow": new_internal,
            }

        # ── Remove unconnected + content-empty modules ──────────────────────
        final_modules = []
        removed_mods = 0
        for m_id, m_info in module_details.items():
            if m_id not in connected_modules:
                has_content = bool(
                    m_info.get("function") or
                    m_info.get("brief_description") or
                    m_info.get("sub_nodes")
                )
                if not has_content:
                    print(f"  Removed isolated empty module: '{m_id}'")
                    removed_mods += 1
                    continue
                print(f"  Kept isolated module '{m_id}' (has content — review recommended)")
            final_modules.append(m_info)

        data["module_details"] = final_modules
        print(f"✅ ConflictSolver: removed {removed_edges} dangling edges, "
              f"deduped {deduped} duplicate edges, removed {removed_mods} empty isolated modules.")
        return json.dumps(data, ensure_ascii=False)
    

if __name__ == "__main__":
    vector_store = get_vector_store()
    graph_store = get_graph_store()
    planner = PlannerAgent(client, graph_store)
    user_query = "Design an LLM-based code education system for children"
    base_anchors = []
    divergent_plans = planner.divergent_planning(
            user_query=user_query,
            base_anchors=base_anchors,
            num_outputs=1
    )
    print(divergent_plans)
