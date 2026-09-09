import { HfInference } from '@huggingface/inference'

const hfToken = process.env.HF_API_TOKEN || process.env.HF_API_KEY || ''
const client = new HfInference(hfToken)

export async function getEmbeddings(text: string) {
  const model = 'sentence-transformers/all-MiniLM-L6-v2'
  const res = await client.featureExtraction({ model, inputs: { text } })

  if (Array.isArray(res)) {
    return res as number[]
  }

  if (Array.isArray((res as any)?.data)) {
    return (res as any).data[0] ?? null
  }

  if (Array.isArray((res as any)?.embedding)) {
    return (res as any).embedding
  }

  return null
}

export async function chatCompletion(messages: Array<{ role: string; content: string }>) {
  const model = 'google/gemma-2b-it'
  const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n')
  const res = await client.textGeneration({
    model,
    inputs: prompt,
    parameters: { max_new_tokens: 200 }
  })
  return res
}
