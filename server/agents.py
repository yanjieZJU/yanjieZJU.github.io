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
    load_stores, 
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
        
        # A. Near Field (Top 1)
        if scored_clusters:
            near_cluster_id = scored_clusters[0][0]
            near_score = scored_clusters[0][1]
            
            if near_score < 0.5:
                selected_references.append({
                    "type": "NEAR_FIELD_MISSING",
                    "cluster_id": None,
                    "score": near_score,
                    "name": "No Relevant Papers Found"
                })
                print(f"⚠️ Near-Field Context Score low ({near_score:.2f} < 0.5). Marked as missing.")
            else:
                selected_references.append({
                    "type": "NEAR_FIELD",
                    "cluster_id": near_cluster_id,
                    "score": near_score,
                    "name": self.topology_knowledge["scene_clusters"][near_cluster_id]["name"]
                })
                print(f"🎯 Near-Field Context: {self.topology_knowledge['scene_clusters'][near_cluster_id]['name'][:50]}... (Score: {near_score:.2f})")

        # B. Far Field (Random Sampling)
        near_id_set = {scored_clusters[0][0]} if scored_clusters else set()
        far_candidates = [c for c in scored_clusters if 0.3 <= c[1] <= 0.6 and c[0] not in near_id_set]
        
        needed_far = max(0, num_outputs - 1)
        if far_candidates and needed_far > 0:
            import random
            # Sample without replacement if possible
            k = min(len(far_candidates), needed_far)
            chosen_far = random.sample(far_candidates, k)
            
            for c_id, c_score in chosen_far:
                selected_references.append({
                    "type": "FAR_FIELD",
                    "cluster_id": c_id,
                    "score": c_score,
                    "name": self.topology_knowledge["scene_clusters"][c_id]["name"]
                })
                print(f"🚀 Far-Field Context: {self.topology_knowledge['scene_clusters'][c_id]['name'][:50]}... (Score: {c_score:.2f})")
        
        # Fill remaining with random near/mid if we ran out of far candidates
        while len(selected_references) < num_outputs:
             # Just pick next best near ones or randoms
             # for simplicity, just pick from top list excluding already picked
             existing_ids = set(r["cluster_id"] for r in selected_references if r["cluster_id"] is not None)
             residue = [c for c in scored_clusters if c[0] not in existing_ids]
             if not residue: break
             c_id, c_score = residue[0]
             selected_references.append({
                "type": "SUPPLEMENTAL",
                "cluster_id": c_id,
                "score": c_score,
                "name": self.topology_knowledge["scene_clusters"][c_id]["name"]
            })
        
        # 3. Retrieve Capabilities for specific references
        # We want to give the LLM specific "Reference Packs"
        
        reference_context_str = ""

        # Pre-fetch community summaries for all selected references in parallel
        def _fetch_summaries_for_ref(ref):
            if ref["type"] == "NEAR_FIELD_MISSING" or ref["cluster_id"] is None:
                return ref["cluster_id"], []
            c_id = ref["cluster_id"]
            cluster_data = self.topology_knowledge["scene_clusters"][c_id]
            comm_dist = cluster_data.get("community_distribution", {})
            sorted_comms = sorted(comm_dist.items(), key=lambda x: x[1], reverse=True)
            relevant_comm_ids = [c[0] for c in sorted_comms[:6]]
            if not relevant_comm_ids:
                return c_id, []
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
                return c_id, [f"- [Community {r['id']}]: {r['summary']}" for r in records]
            except Exception as e:
                print(f"⚠️ Failed to fetch community summaries for planning: {e}")
                return c_id, []

        refs_needing_fetch = [r for r in selected_references if r["type"] != "NEAR_FIELD_MISSING" and r["cluster_id"] is not None]
        comm_summaries_cache = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(refs_needing_fetch) or 1) as _ex:
            for c_id, lines in _ex.map(_fetch_summaries_for_ref, refs_needing_fetch):
                comm_summaries_cache[c_id] = lines

        for idx, ref in enumerate(selected_references):
            if ref["type"] == "NEAR_FIELD_MISSING":
                ref_block = f"""
            ### Source {idx + 1} (Near-Field):
            Condition: Similarity score {ref['score']:.2f} < 0.5.
            Message: No papers highly relevant to this system were retrieved.
            """
                reference_context_str += ref_block
                continue

            c_id = ref["cluster_id"]
            if c_id is None: continue

            cluster_data = self.topology_knowledge["scene_clusters"][c_id]
            comm_summaries_text = comm_summaries_cache.get(c_id, [])

            # Extract Common Patterns with Claims
            patterns_text = []
            for p_key in ["common_patterns_3", "common_patterns_4"]:
                patterns = cluster_data.get(p_key, [])
                # Take top 3 sorted by count
                patterns.sort(key=lambda x: x.get("count", 0), reverse=True)
                for pat in patterns[:3]:
                    seq = pat.get("sequence", [])
                    claim = pat.get("claim", "")
                    if seq and claim:
                        seq_str = " -> ".join(seq)
                        patterns_text.append(f"- Pattern: [{seq_str}]\n  * Insight: {claim}")

            patterns_section = ""
            if patterns_text:
                patterns_section = "\n**Common Workflow Patterns & Insights:**\n" + "\n".join(patterns_text)

            ref_block = f"""
            ### Source {idx + 1} ({ref['type']} - Dist: {1-ref['score']:.2f}): {cluster_data['name']}
            **Key Functional Communities in this domain:**
            {chr(10).join(comm_summaries_text)}
            {patterns_section}
            """
            reference_context_str += ref_block

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
        
        ## Reference Material (Knowledge Injection)
        We have retrieved knowledge from different domain clusters to inspire you.
        Please strictly follow the mapping below to generate your plans:
        
        {reference_context_str}
        
        ## Requirements by Plan
        
        **Plan 1 (Deep Optimization)**:
        - Use **Source 1** (Near-Field) as your inspiration.
        - If Source 1 states "No papers highly relevant", explicitly mention "No papers highly relevant to this system were retrieved" in your rationale, and rely on general HCI knowledge to professionalize the system.
        - Focus on discovering **innovative and feasible functional embeddings** and deep professional details missing from the Base Anchors. Focus on the most advanced or unique technical methods in the community summaries, rather than conventional ones.
        
        **Plan 2 (Cross-Domain Inspiration)** (If requested):
        - Use **Source 2** (Far-Field) as your inspiration. Try to answer: "How would an expert with new tech in Source 2 solve the problems in the User's query?"
        - Focus on **innovative cross-domain transfer**: Instead of just introducing conventional ideas, extract typical processing patterns, novel technologies or main implementation methods from Source 2 that can significantly improve the performance of the system.
        - Perform **Concept Blending**: specific methods from Source 2 (e.g., "Medical Monitoring") should be metaphorically and innovatively transferred to the User's domain (e.g., "Education Monitoring").
        
        **Plan 3+** (If requested):
        - Use **Source 3+** similarly to propose a DISTINCT innovative functional embedding, differing in implementation methods or referenced technologies from previous plans.

        ## General Constraint
        1. When you add new functions, always consider its *feasibility* in the given context.
        2. **Base Anchors Preservation**:
           - **CRITICAL**: The existing Base Anchors represent the core of the system. Your divergent plans MUST acknowledge them, build upon them, and seamlessly integrate new functionalities with them across ALL plans.
        3. **Incremental Only**: 
           - Do NOT output the existing Base Anchors in your array. Output ONLY the KEY and ADDITIONAL innovative components (modules). IF Base Anchors do NOT exist, extract the key components from the user's query and add them.
           - **CRITICAL**: Do NOT propose modules that are merely synonyms or simple rephrasings of Base Anchors (e.g., if "Tutor" exists, do not add "Instructor Agent"). New anchors must add **distinct and innovative new functionality**.
        4. **Specific Anchors**:
           - Each additional component must have a 'user_term', a 'description', a 'role', and a 'community_id' (from the reference source).
           - Recheck data flow logic.

        ### Role Taxonomy
        {TAXONOMY}\n\n

        ## Output Structure (JSON)
        {{
            "plans": [
                {{
                    "perspective": "use one short phrase to describe the perspective, highlighting the key functions or biggest advantages and innovations of this design (e.g., 'Immersive interactive feedback'). Do not just copy the perspective title or vague terms like 'cross-domain'",
                    "rationale": "Explain explicitly: 'Inspired by [Source Name], we introduced [Feature] to achieve [Goal]...'",
                    "additional_anchors": [
                        {{
                            "user_term": "Specific Module Name",
                            "description": "Functional description",
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
        try:
            response = self.client.chat.completions.create(
                # model="gpt-4o-2024-11-20",
                model = "gpt-5.2-chat-latest",

                messages=[{"role": "user", "content": prompt}],
                temperature=0.9, # Higher temperature for creativity
                response_format={"type": "json_object"},
            ).choices[0].message.content
            
            # print(f"LLM Response: {str(response)}")
            result = json.loads(response)
            plans = result.get("plans", [])
            
            # Validate output count
            if len(plans) < num_outputs:
                print(f"⚠️ Warning: LLM generated {len(plans)} plans, requested {num_outputs}.")
            
            return plans[:num_outputs]

        except Exception as e:
            print(f"❌ Error in divergent planning: {e}")
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
    
    # def rerank_with_llm(self, query, retrieved_skeletons):
    #     if not retrieved_skeletons: return []
    #     candidates_text = ""
    #     for i, node in enumerate(retrieved_skeletons):
    #         content_preview = node.node.text[:500].replace("\n", " ")
    #         candidates_text += f"--- Candidate {i} ---\n {content_preview}\n\n"
    #     prompt = f"""
    #     ##TASK:
    #     Identify the SINGLE candidate from the list below that BEST matches the user's specific requirements.

    #     ##CRITERIA:
    #     1. The candidate must be the most relevant to the user's requirements.
    #     2. The candidate must be the most complete to include the specific nodes mentioned in the user's query.

    #     ##Candidates:
    #     {candidates_text}

    #     ##User Query:
    #     {query}

    #     ##Output Format:
    #     Return the top 3 indices of the best candidates in order of preference (e.g., "1, 2, 0").

    #     """
    #     try:
    #         response = self.client.chat.completions.create(
    #             model="gpt-4o-mini",
    #             messages=[{"role": "user", "content": prompt}],
    #             temperature=0,
    #         ).choices[0].message.content
    #         indices = [int(x.strip()) for x in response.split(",") if x.strip().isdigit()]
    #         valid_skeletons = []
    #         for i in indices:
    #             if 0 <= i < len(retrieved_skeletons):
    #                 valid_skeletons.append(retrieved_skeletons[i])

    #         if len(valid_skeletons) < 3:
    #             remaining_indices = [idx for idx in range(len(retrieved_skeletons)) if idx not in indices]
    #             for idx in remaining_indices:
    #                 if len(valid_skeletons) < 3:
    #                     valid_skeletons.append(retrieved_skeletons[idx])

    #         return valid_skeletons
            
    #     except Exception as e:
    #         print(f"Error: {e}")
    #         return None


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
                """
        else:
             # Fallback if old call signature is used or no plan
             extension_context = "No specific divergent extensions provided."

        slim_retrieved_info = {}
        for anchor, nodes in retrieved_info.items():
            slim_nodes = []
            for n in nodes:
                node_data = {
                    "module": n.get('metadata', {}).get('name', 'Unknown'),
                    "content": n.get('text', '')
                }
                
                # If this is an added node, explicitly preserve its topology 
                if anchor in added_keys:
                    # Try to get raw topology from metadata as a cleaner signal
                    raw_topo = n.get('structural_path', None)
                    if not raw_topo: 
                        raw_topo = n.get('metadata', {}).get('topology', None)
                        
                    if raw_topo:
                        # Simplify topology data to avoid huge dumps
                        simplified_topo = {
                            "upstream": [u['name'] for u in raw_topo.get('upstream', [])],
                            "downstream": [d['name'] for d in raw_topo.get('downstream', [])]
                        }
                        node_data["structural_context"] = simplified_topo
                
                slim_nodes.append(node_data)
            slim_retrieved_info[anchor] = slim_nodes

        prompt = f"""
        You are a professional designer and architect in the field of HCI. Design a *complete and detailed* pipeline to meet the user's requirements.
        
        ## User Requirements
        User Query: ```{query}```
        
        ## Base Anchors (MANDATORY)
        The following Base Anchors were explicitly requested by the user. **You MUST include ALL of these modules in your final pipeline architecture.** You can modify its name, details, and implementation method, but please retain the main functions as requested by the users. Do not drop them under any circumstances.
        Base Anchors: ```{json.dumps(base_anchors, ensure_ascii=False) if base_anchors else "None provided"}```
        \n\n
        ## Retrieved Information
        You have the following sources of information. Use them according to the rules.
        1. **Retrieved Modules**: 
            - These are modules extracted from the domain-specific literature that are similar to each conceptual step. Their descriptions include their functions and specific technical methods.
            - Refer to them to fill in the technical implementation of these specific nodes. But you SHOULD abstract away the original paper context (such as the nameing of the module in the article). Translate the core technical concepts into generic terms and tightly fuse them with the user's specific scenario. The generated explanations should feel like a native, tailored solution to the user's problem.
            - Each conceptual step may have retrieved multiple nodes with similar functions. You need to conduct appropriate screening or combination to be able to assemble a complete process.
        2. **Structural Paths**: 
            - These are retrieved data flow connections between conceptual steps derived from the user's requirements.
            - **CRITICAL**: Use them as the ground truth to determine HOW the user's nodes should be connected. Do not invent arbitrary connections if a structural path already defines them.
            - If the paths suggest the need for an intermediate node (e.g., Sensor -> [Buffer] -> LLM), then such a node MUST be added to connect the Base Anchors logically.

        ## Data Sources
        {extension_context}

        Retrieved Modules: ```{json.dumps(slim_retrieved_info, ensure_ascii=False, indent=2)}```\n\n
        Structural Paths: ```{hints_text}```\n\n
        
        ## TASK
        Conceive the complete data link and functional architecture, and ultimately synthesize a cohesive flowchart/architecture diagram.
        ## Language Policy
        - Keep retrieval-grounded technical content unchanged in meaning.
        - User-facing textual fields in final JSON should be primarily in Chinese.
        - Proper nouns and necessary technical terms may remain in English.
        ### Steps and Rules 
        1. **Define the main storyline**: Define a clear functional mainline based on the user's requirements and the provided perspective, and synthesize a detailed overall_description of the main storyline.
        2. **Define Modules**: Define all the necessary modules for this achitecture. Keep it concise, with a maximum of 6-8 key functional processing modules (input and output nodes are not considered as functional processing modules). Define inputs and outputs
        First, consider all the modules that are necessary for the mainline, including the base anchors. 
        Then, in addition to the main line, add supporting functional nodes. These nodes can be connected to the main line and derived from it, but they MUST NOT be completely independent of the main line.
            - **Naming Rule**: Use concise, plain-language names that describe *what the node does*, not what it is. Avoid generic structural suffixes like "模块", "单元", "矩阵", "引擎", "系统", "组件", "层", "网络". Instead of "优先级解释展示单元" use "优先级解释"; instead of "动态优先级与资源决策模块" use "优先级动态分析"; instead of "任务特征抽取单元" use "任务特征提取". DO NOT directly copy wording from the paper. DO NOT use technical labels (such as parser, engine, neural network, etc.) or long implementation names (e.g. NOT "Gaze360: Physically Unconstrained...").
            - Ensure the added nodes from the divergent plans are integrated meaningfully.
            - **Provide detailed descriptions for both `function` and `technical_methods` from the retrieved information BUT DO NOT FABRICATE.** You must explicitly articulate the module's specific role, core responsibilities, and crucial importance within the overall system. Explain exactly HOW the technical methods work, process data, and why they were chosen, avoiding brief or vague summaries.
            - If there are subnodes within the modules (based on the retrieved information and relevant to the current context), they should also be defined. Explicitly map out the intermediate processes and data flow within the module using subnodes so its internal logic is transparent.
        3. **Connect the Flow**: Use the topology info to decide logical connections. 
            - Ensure the architecture has a clear primary end-to-end flow across the core modules.
            - Ensure new conceptual modules have meaningfully integrated into the base logic, but do not connect them to every possibly related module. A module only needs the minimum necessary connections to realize its functional role.
            - Prefer module-level connections, unless a subnode is truly the key sender or receiver. ONLY use subnode-level external connections when the subnode is the actual locus of computation or decision and connecting at module level would hide an important mechanism.
            - All the connections should be implemented from the modules defined above. Do not include any other nodes, especially when defining the source_mod and the target_mod in ports.
            - **Graph Cleaning**: Merge parallel edges between the same two nodes. Do not create 'shadow' nodes that duplicate existing functions. Ensure the graph is a single connected component if possible.
            - If Module A usually follows Module B in Paper X, try to preserve that flow if it fits.
        4. **Check the architecture**:
            - REMOVE redundant nodes and connections (perform the same function even with different names).
            - REMOVE or RECHECK any nodes that are isolated or unused.
            - Favor a diagram that is readable and topologically coherent, rather than one with maximally dense connectivity.
        
        ### Final Output Structure (in JSON format)
        {{
            "overall_description": "A concise, clear explanation of the overall system architecture, highlighting its mainline and innovation points",
            "module_details": [
                {{
                    "name": "the module name",
                    "brief_description": "A one-sentence concise explanation of the module's core functional role, meant directly for rendering on the visual node. Emphasize how it serves the current scenario without paper-specific jargon.",
                    "function": "Detailed explanation of the module's function, its core responsibilities, and its crucial role and importance within the overall system architecture.",
                    "technical_methods": "Detailed description of the specific algorithms, models, or technical methods used, including HOW they process data and why they are selected. You MUST abstract away the original paper context. ",
                    "role": "choose from ["input", "output", "processing", "data"]",
                    "references": "Exact names of the sourced modules from Retrieved Information, comma-separated. Use 'None' if not available.",
                    "sub_nodes": [
                        {{
                            "name": "name of the subnode",
                            "function": "Detailed description of the subnode's specific function, purpose, and contribution to its parent module.",
                            "technical_methods": "Detailed description of the specific technical implementation and methods used by this subnode."
                        }}
                    ],
                    "ports": {{
                        "incoming": [
                            {{
                                "source_mod": "id of the source module",
                                "source_node": "id of the source subnode (if applicable, else null)",
                                "connects_to_internal_node": "id of the internal subnode (if applicable, else null)",
                                "edge_label": "description of data/control flow"
                            }}
                        ],
                        "outgoing": [
                             {{
                                "target_mod": "id of the target module",
                                "target_node": "id of the target subnode (if applicable, else null)",
                                "originates_from_internal_node": "id of the internal subnode (if applicable, else null)",
                                "edge_label": "description of data/control flow"
                            }}
                        ],
                        "internal_flow": [
                           {{
                                "source_node": "id of the internal source subnode",
                                "target_node": "id of the internal target subnode",
                                "edge_label": "description of data/control flow"
                           }}
                        ]
                    }}
                }}
            ]
        }}
    """
        try:
            response = self.client.chat.completions.create(
                # model="gpt-4o-2024-11-20",
                model = "gpt-5.2-chat-latest",

                messages=[{"role": "user", "content": prompt}],
                temperature=0.8,
                response_format={"type": "json_object"},
            ).choices[0].message.content
        except Exception as e:
            print(f"Error: {e}")
            return None
        try:
            print(response)
        except json.JSONDecodeError:
            print("Failed to parse JSON response.")
            return None
        return response

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
        try:
            response = self.client.chat.completions.create(
                # model="gpt-4o-2024-11-20",
                model = "gpt-5.2-chat-latest",

                messages=[{"role": "user", "content": prompt}],
                temperature=0.1, # Lower temperature for precision fixes
                response_format={"type": "json_object"},
            ).choices[0].message.content
            return response
        except Exception as e:
            print(f"Error checking integrity: {e}")
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
        if not arch_plan or "module_details" not in arch_plan:
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
        self.model = "gpt-5.2-chat-latest"

    def edit_plan(self, current_plan, user_instruction, history_summary, retriever):
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
        {json.dumps(current_plan, indent=2)}
        
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
        
        ## Modification Rules
        1. **Locality**: Only change what is requested.
           - In single-node mode, modify only the target module, its `sub_nodes`, and minimally required adjacent edges.
           - Keep all other modules unchanged unless a strict consistency fix is necessary.
        2. **Preservation**: Keep existing modules unless asked to remove them.
        3. **Consistency**: Ensure the graph remains connected and logical.
        4. **Integrity**: Ensure all `source_mod` and `target_mod` in ports refer to valid keys in `module_details`.
        5. **Naming Rule**: When adding or renaming nodes, use concise plain-language names that describe *what the node does*. Avoid generic structural suffixes like "模块", "单元", "矩阵", "引擎", "系统", "组件", "层", "网络". For example: "优先级解释" not "优先级解释展示单元"; "优先级动态分析" not "动态优先级与资源决策模块"; "任务特征提取" not "任务特征抽取单元".
        
        
        ## Final Output Format
        If you choose plan_update, output:
        {{
            "output_type": "plan_update",
            "modification_intent": "A concise summary of what you changed (e.g., 'Added Authentication Module and connected it to User Interface')",
            "revised_plan": {{
                "overall_description": "The overall description of the ENTIRE revised system architecture. Update the original description to reflect your changes, but DO NOT just write your modification intent here.",
                "module_details": [
                    {{
                        "name": "ModuleNameA",
                        "brief_description": "...",
                        "function": "Detailed explanation of the module's function, its core responsibilities, and its crucial role and importance within the overall system architecture.",
                        "technical_methods": "Detailed description of the specific algorithms, models, or technical methods used, including HOW they process data and why they are selected. You MUST abstract away the original paper context. ",
                        "role": "choose from ['input', 'output', 'processing', 'data']",
                        "sub_nodes": [],
                        "ports": {{}}
                    }},
                    {{
                        "name": "ModuleNameB",
                        "brief_description": "...",
                        "function": "...",
                        "technical_methods": "...",
                        "role": "...",
                        "sub_nodes": [],
                        "ports": {{}}
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
        2. `module_details` MUST be a LIST containing the FULL, COMPLETE architecture with ALL nodes (both modified and unmodified) as objects. Do NOT only output the changed nodes. Failure to output unmodified nodes will break the system.
        3. For non-plan_update modes, do NOT output revised_plan and do NOT alter the plan.
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
        Post-edit reflection: if the editor produced a plan_update, check whether
        any nodes from the original plan were silently dropped without justification.
        If so, ask the LLM to restore them while keeping the editor's changes intact.
        Returns the (possibly corrected) result dict.
        """
        # Only apply to plan_update responses
        if not isinstance(result, dict) or result.get("output_type") != "plan_update":
            return result

        revised_plan = result.get("revised_plan")
        if not revised_plan:
            return result

        def get_module_names(plan):
            if not isinstance(plan, dict):
                return set()
            md = plan.get("module_details", [])
            if isinstance(md, list):
                return {m.get("name", "") for m in md if m.get("name")}
            if isinstance(md, dict):
                return set(md.keys())
            return set()

        orig_names    = get_module_names(original_plan if isinstance(original_plan, dict) else {})
        revised_names = get_module_names(revised_plan)
        dropped       = orig_names - revised_names

        if not dropped:
            print("✅ Reflection: No nodes were silently dropped.")
            return result

        print(f"⚠️  Reflection: {len(dropped)} node(s) missing from revised plan: {dropped}")

        # Build lookup for original module entries
        orig_md = (original_plan if isinstance(original_plan, dict) else {}).get("module_details", [])
        if isinstance(orig_md, list):
            orig_lookup = {m.get("name", ""): m for m in orig_md}
        else:
            orig_lookup = dict(orig_md)

        prompt = f"""You are a careful architecture reviewer. An EditorAgent just modified a system architecture.
Your job is to decide which dropped nodes should be RESTORED and which were legitimately removed.

## User Instruction
{user_instruction}

## Nodes present in the original plan but MISSING from the revised plan
{json.dumps(list(dropped), ensure_ascii=False, indent=2)}

## Original definitions of those nodes
{json.dumps({n: orig_lookup.get(n, {}) for n in dropped}, ensure_ascii=False, indent=2)}

## Revised plan (editor output)
{json.dumps(revised_plan, ensure_ascii=False, indent=2)}

## Rules
1. RESTORE a node if:
   - The user instruction did NOT ask to remove it.
   - It is not functionally duplicated by a new/renamed node in the revised plan.
   - Removing it breaks connectivity or completeness of the architecture.
2. LEAVE OUT a node if:
   - The user explicitly asked to remove it.
   - It is clearly superseded by a renamed or restructured node in the revised plan.
   - It was isolated or redundant.

## Output (strict JSON, no markdown)
Return the corrected full revised plan. If you restore nodes, re-integrate their ports
so the graph stays connected. Keep all editor changes intact.

{{
  "restored_nodes": ["list of node names you are restoring, empty list if none"],
  "rationale": "brief explanation",
  "revised_plan": {{ ...full corrected plan with overall_description and module_details... }}
}}"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
            )
            reflection_result = json.loads(response.choices[0].message.content)
            restored = reflection_result.get("restored_nodes", [])
            corrected_plan = reflection_result.get("revised_plan")
            if restored:
                print(f"✅ Reflection: Restored {restored}. Reason: {reflection_result.get('rationale', '')}")
            else:
                print("✅ Reflection: All dropped nodes were legitimately removed.")
            if corrected_plan:
                result["revised_plan"] = corrected_plan
        except Exception as e:
            print(f"⚠️  Reflection call failed ({e}), keeping editor output unchanged.")

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
    vector_store, graph_store = load_stores()
    planner = PlannerAgent(client, graph_store)
    user_query = "Design an LLM-based code education system for children"
    base_anchors = []
    divergent_plans = planner.divergent_planning(
            user_query=user_query,
            base_anchors=base_anchors,
            num_outputs=1
    )
    print(divergent_plans)
