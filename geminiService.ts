
import { GoogleGenAI, Type } from "@google/genai";
import { User, TechnicalCompetency } from "./types";

export interface SuggestionContext {
  busyInstructorIds: string[];
  instructorLoads: Record<string, number>;
  requiredCompetencyIds?: string[];
  allCompetencies: TechnicalCompetency[];
}

export const suggestInstructor = async (
  subject: string,
  users: User[],
  context: SuggestionContext
): Promise<string[]> => {
  const allPotentialInstructors = users.filter(u => u.competencyIds && u.competencyIds.length > 0);

  // Fallback se não houver API Key: sugestão básica por competência e disponibilidade
  if (!process.env.API_KEY) {
    return allPotentialInstructors
      .filter(inst => {
        const hasOneRequired = context.requiredCompetencyIds?.some(id => inst.competencyIds?.includes(id)) ?? true;
        const isBusy = context?.busyInstructorIds.includes(inst.id);
        return hasOneRequired && !isBusy;
      })
      .sort((a, b) => (context?.instructorLoads[a.id] || 0) - (context?.instructorLoads[b.id] || 0))
      .map(inst => inst.id);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const instructorsData = allPotentialInstructors.map(i => ({
      id: i.id,
      name: i.name,
      competencies: i.competencyIds?.map(id => context.allCompetencies.find(ac => ac.id === id)?.name),
      isBusy: context?.busyInstructorIds.includes(i.id),
      currentLoad: context?.instructorLoads[i.id] || 0
    }));

    const requiredCompNames = context.requiredCompetencyIds
      ?.map(id => context.allCompetencies.find(ac => ac.id === id)?.name)
      .filter(Boolean)
      .join(", ") || subject;

    const prompt = `Você é um Assistente de Gestão de Escala do SENAI Uberlândia.
Seu objetivo é sugerir os 3 melhores instrutores para a Unidade Curricular: "${subject}".
Competências Requisitadas: "${requiredCompNames}".

REGRAS DE PRIORIDADE (Siga rigorosamente):
1. DISPONIBILIDADE: Priorize instrutores com "isBusy: false". Um instrutor disponível SEMPRE é preferível a um ocupado, mesmo que o ocupado tenha mais competências.
2. COMPETÊNCIA: O instrutor deve possuir as competências técnicas necessárias.
3. CARGA HORÁRIA: Entre dois instrutores disponíveis e competentes, escolha o que tem menor "currentLoad".

Analise estes dados e retorne APENAS um array JSON com os IDs dos 3 melhores candidatos:
${JSON.stringify(instructorsData)}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) return [];

    const jsonStr = textOutput.trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Suggestion Error:", error);
    return [];
  }
};
