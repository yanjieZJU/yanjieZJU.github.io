import os

# === OpenAI Configuration ===
os.environ["OPENAI_API_KEY"] = "sk-y44HwiOqlzdvdMwiVGmyzpITjGQdkwWS0bJuDMWN2awpHnX7"
os.environ["OPENAI_BASE_URL"] = "https://poloapi.top/v1"

# === Multi-Key Pool (round-robin load balancing) ===
# Add more keys here to distribute concurrent requests across accounts.
# All keys must work with the same OPENAI_BASE_URL above.
OPENAI_API_KEYS = [
    "sk-y44HwiOqlzdvdMwiVGmyzpITjGQdkwWS0bJuDMWN2awpHnX7",
    "sk-HOhPpbrbpl2pEa9UU6BGea6I2O93cLYX1eS342bLaMypwvlc",
    # "sk-THIRD_KEY_HERE",
]

# === Model Configuration ===
# Change this one line to switch models across the entire backend
CHAT_MODEL = "gpt-5.4-mini"
# CHAT_MODEL = "gpt-5"

os.environ["DASHSCOPE_API_KEY"] = "sk-8d86e8ae17e04f6aacff4a43cfae481a"

# === Neo4j Configuration ===
NEO4J_USERNAME = "neo4j"
NEO4J_PASSWORD = "BQLjYc4gOpIxTi6o5c-es481vKejEHHBGuxJeEvX9hg"
NEO4J_URL = "neo4j+s://8891a7fc.databases.neo4j.io"

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