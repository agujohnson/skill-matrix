// api/scan-cv.js
// Vercel serverless function — Anthropic key lives here only, never in the browser.
// Deploy: set ANTHROPIC_API_KEY in Vercel dashboard → Project Settings → Environment Variables

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY environment variable is not set. Configure it in the Vercel dashboard.'
    })
  }

  const { text, skills, certs, practices } = req.body

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid CV text' })
  }

  const skillsList = (skills || []).slice(0, 200).map(s => `${s.id}|${s.name} (${s.domain})`).join('\n')
  const certsList  = (certs  || []).slice(0, 100).map(c => `${c.id}|${c.name}${c.provider ? ' - ' + c.provider : ''}`).join('\n')
  const practicesList = (practices || []).join(', ')

  const prompt = `You are analyzing a CV/Resume to extract structured data for a skills matrix platform.

AVAILABLE SKILLS (format: id|name (domain)):
${skillsList}

AVAILABLE CERTIFICATIONS (format: id|name):
${certsList}

AVAILABLE PRACTICES: ${practicesList}

CV TEXT:
${text.substring(0, 6000)}

INSTRUCTIONS:
- Extract the person's full name and email address
- Suggest the most appropriate practice from the AVAILABLE PRACTICES list
- Map their experience to skills from AVAILABLE SKILLS only. Use proficiency: 1=Awareness, 2=Working, 3=Advanced, 4=Expert. Only include skills you are confident about. Do NOT invent skill IDs.
- Map their certifications to AVAILABLE CERTIFICATIONS only. Only include certs you are confident about.
- If you are unsure about any skill or cert mapping, omit it rather than guess.

Respond ONLY with a valid JSON object, no markdown, no explanation:
{
  "name": "Full Name",
  "email": "email@example.com or null",
  "suggestedPractice": "one of the available practices",
  "practiceReason": "one sentence explanation",
  "skills": [
    {"skillId": "exact_id_from_list", "skillName": "name", "proficiency": 1-4, "confidence": "high|medium"}
  ],
  "certifications": [
    {"certId": "exact_id_from_list", "certName": "name", "status": "Earned", "confidence": "high|medium"}
  ],
  "summary": "2-3 sentence professional summary based on the CV"
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      return res.status(response.status).json({
        error: err.error?.message || `Anthropic API error ${response.status}`
      })
    }

    const data = await response.json()
    const raw = data.content.find(b => b.type === 'text')?.text || ''
    const clean = raw.replace(/```json|```/g, '').trim()

    let parsed
    try {
      parsed = JSON.parse(clean)
    } catch {
      return res.status(500).json({ error: 'Failed to parse Claude response as JSON', raw: clean.substring(0, 500) })
    }

    return res.status(200).json(parsed)

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
