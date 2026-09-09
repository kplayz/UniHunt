import { InferenceClient } from '@huggingface/inference'

const hfToken = process.env.HF_API_TOKEN || ''
const client = new InferenceClient({ apiKey: hfToken })

export async function getEmbeddings(text: string) {
  // placeholder: model choice and options can be configured
  const model = 'sentence-transformers/all-MiniLM-L6-v2'
  const res = await client.embeddings.create({ model, input: text })
  return res.data?.[0]?.embedding ?? null
}

export async function chatCompletion(messages: Array<{ role: string; content: string }>) {
  const model = 'gpt2' // replace with chosen HF model
  const res = await client.chat.completions.create({ model, messages })
  return res
}
