import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode, resumeText } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Different system prompts based on mode
    let systemPrompt = "";
    
    if (mode === "interviewer") {
      systemPrompt = `You are an expert interview assistant helping interviewers conduct effective technical and behavioral interviews.

${resumeText ? `The candidate's resume content is provided below. Use this to generate relevant, targeted questions:

RESUME:
${resumeText}

Based on this resume:` : ""}

Your responsibilities:
1. Suggest relevant technical questions based on the candidate's experience and skills
2. Provide follow-up questions to dig deeper into specific areas
3. Suggest behavioral questions using the STAR method
4. Help evaluate candidate responses with constructive feedback
5. Recommend areas to probe based on job requirements

Keep your responses concise and actionable. Format questions clearly.`;
    } else {
      systemPrompt = `You are a friendly interview coach helping candidates prepare for their upcoming interviews.

${resumeText ? `The candidate's resume is provided below. Use this to provide personalized advice:

RESUME:
${resumeText}

Based on this resume:` : ""}

Your responsibilities:
1. Help candidates practice common interview questions
2. Provide tips on how to present their experience effectively
3. Suggest improvements to their answers using the STAR method
4. Give constructive feedback on their responses
5. Help them prepare questions to ask the interviewer
6. Reduce interview anxiety with encouragement and practical tips

Be supportive, encouraging, and specific in your guidance.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Interview assistant error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
