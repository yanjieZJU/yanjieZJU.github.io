import os

# === OpenAI Configuration ===
os.environ["OPENAI_API_KEY"] = "YOUR API KEY" 
os.environ["OPENAI_BASE_URL"] = "BASE URL"

os.environ["DASHSCOPE_API_KEY"] = ""

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
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "How are you?"}],
        temperature=0.2,
    ).choices[0].message.content)
