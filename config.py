import os

# === OpenAI Configuration ===
os.environ["OPENAI_API_KEY"] = "sk-y44HwiOqlzdvdMwiVGmyzpITjGQdkwWS0bJuDMWN2awpHnX7"
os.environ["OPENAI_BASE_URL"] = "https://poloapi.top/v1"

os.environ["DASHSCOPE_API_KEY"] = ""

# === Model Configuration ===
# Change this one line to switch models across the entire backend
CHAT_MODEL = "gpt-5.4-mini"
# CHAT_MODEL = "gpt-5"


# === Neo4j Configuration ===
NEO4J_USERNAME = ""
NEO4J_PASSWORD = ""
NEO4J_URL = ""

# === API KEY TEST ===
if __name__ == "__main__":
    from openai import OpenAI
    import httpx
    http_client = httpx.Client(proxy=None, trust_env=False)
    client = OpenAI(http_client=http_client)
    
    print(client.chat.completions.create(
        model=CHAT_MODEL,
        messages=[{"role": "user", "content": "How are you?"}],
        temperature=0.2,
    ).choices[0].message.content)
