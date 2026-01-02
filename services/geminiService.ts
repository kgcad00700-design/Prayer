
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { RepresentativeSettings, FuneralSettings, GroundingSource } from "../types";

// TypeScript declaration for process.env
declare var process: {
  env: {
    API_KEY: string;
  };
};

/**
 * 특정 기도 섹션만 Google Search를 통해 독립적으로 검색 및 생성하는 함수
 */
export const generatePrayerSegment = async (
  segmentName: string, 
  context: { churchName: string; churchSeason: string; otherSeason?: string }
): Promise<string> => {
  // 호출 시점에 새 인스턴스 생성 (API 키 최신 상태 유지)
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const season = context.churchSeason === '기타' ? context.otherSeason : context.churchSeason;
  
  const prompt = `
    당신은 전 세계 기독교 문학 및 신학적 깊이가 가장 뛰어난 기도문 작성 전문가입니다.
    현재 '${context.churchName}'에서 드려지는 예배의 '${segmentName}' 파트를 위해, Google Search를 통해 다음 작업을 수행하세요:
    
    1. 최근 한국 교계에서 가장 은혜롭다고 평가받는 '${season}' 절기 관련 최신 기도 문구와 성경 구절을 검색하십시오.
    2. 특히 '하나님의 측량할 수 없는 은혜'와 '예수 그리스도의 십자가 대속의 보혈의 은혜'가 기도의 가장 중요한 뿌리가 되도록 작성하십시오.
    3. '${context.churchName}'의 영적 정체성과 '${segmentName}'에 어울리는 가장 깊이 있고 울림이 큰 표현을 2~3문장으로 작성하십시오.
    4. 문체는 격조 있는 '전통적 기도체'(~하옵소서)를 기본으로 하되 영적 생동감이 느껴져야 합니다.
    
    출력은 오직 기도 문구만 하고, 서론이나 결론은 생략하세요.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 4000 }
      },
    });

    return response.text?.trim() || "하나님의 은혜가 해당 영역 가운데 가득하시기를 소망합니다.";
  } catch (error) {
    console.error("Segment generation error:", error);
    return "하나님께서 우리 마음의 기도를 들으시고 가장 선한 것으로 채워주시기를 간절히 원합니다.";
  }
};

/**
 * 전체 대표기도문을 생성하는 함수
 */
export const generateRepresentativePrayer = async (settings: RepresentativeSettings): Promise<{ text: string; sources: GroundingSource[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const toneInstruction = settings.prayerTone === '전통적' 
    ? "장중하고 격식 있는 전통적 문체(~하옵소서)를 사용하십시오." 
    : "현대적이고 진솔하며 따뜻한 문체(~합니다)를 사용하십시오.";

  const finalServiceType = settings.serviceType === '기타' ? settings.otherServiceType : settings.serviceType;
  const finalChurchSeason = settings.churchSeason === '기타' ? settings.otherChurchSeason : settings.churchSeason;

  const prompt = `
    당신은 수만 명의 영혼을 울리는 세계 최고의 기도문 작성가이자 깊은 신학적 소양을 가진 영적 지도자입니다. 
    제공된 정보와 Google Search를 결합하여 '${settings.churchName}'를 위한 최고의 대표기도문을 작성하십시오.
    
    [핵심 주제 및 원칙]
    - 반드시 '하나님의 무한하신 은혜'와 '예수 그리스도의 십자가의 대속적 사랑'을 기도문의 모든 문장 저변에 흐르게 하십시오. 
    - 우리가 보좌 앞에 담대히 나아갈 수 있는 유일한 근거가 '예수 그리스도의 보혈'임을 명시적으로 고백하십시오.

    [설정 정보]
    - 설교자: ${settings.pastorName} ${settings.pastorTitle}
    - 예배: ${finalServiceType} (${finalChurchSeason})
    - 톤: ${settings.prayerTone} (${toneInstruction})
    - 목표 시간: ${settings.prayerDuration}

    [기도문 구성 지침]
    1. 경배와 찬양: ${settings.graceAndSalvation} (성부 하나님의 창조와 섭리, 성자 예수의 십자가 사랑 찬양)
    2. 참회와 회개: ${settings.confessionAndForgiveness} (보혈로 씻어주시는 은혜에 대한 확신)
    3. 나라와 민족: ${settings.nationWellbeing}
    4. 교회와 공동체: ${settings.churchNeeds}
    5. 성도의 환우와 치유: ${settings.specialGraceAndHealing}
    6. 말씀과 설교자: ${settings.preacherFilling}
    7. 추가 간구: ${settings.additionalRequests}

    Google Search를 통해 각 섹션에 가장 적합한 최신 성경 구절과 교계의 은혜로운 표현을 포함시키십시오. 
  `;

  const parts: any[] = [{ text: prompt }];
  if (settings.attachments && settings.attachments.length > 0) {
    settings.attachments.forEach(att => {
      parts.push({
        inlineData: {
          data: att.data,
          mimeType: att.mimeType,
        }
      });
    });
  }

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: parts },
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 8000 }
    },
  });

  const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
    title: chunk.web?.title,
    uri: chunk.web?.uri,
  })).filter((s: any) => s.uri) || [];

  return {
    text: response.text || "기도문 생성 중 오류가 발생했습니다.",
    sources
  };
};

/**
 * 장례기도문을 생성하는 함수
 */
export const generateFuneralPrayer = async (settings: FuneralSettings): Promise<{ text: string; sources: GroundingSource[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    당신은 슬픔에 잠긴 이들에게 천국의 위로와 부활의 소망을 전하는 영적 위로자입니다. 
    고 ${settings.deceasedName} ${settings.deceasedTitle}님의 '${settings.funeralType}' 예배를 위해 위로와 소망의 기도문을 작성하십시오.
    예수 그리스도의 십자가 승리와 부활의 산 소망, 그리고 하나님의 위로하시는 은혜가 유족들에게 큰 평강이 되게 하십시오.

    [세부 정보]
    - 유족 위로: ${settings.familyComfort}
    - 부활의 소망: ${settings.hopeOfResurrection}
    - 추가 요청: ${settings.additionalRequests}

    Google Search를 통해 장례 예배에 어울리는 가장 따뜻하고 경건한 성경 구절을 검색하여 반영하십시오.
  `;

  const parts: any[] = [{ text: prompt }];
  if (settings.attachments && settings.attachments.length > 0) {
    settings.attachments.forEach(att => {
      parts.push({
        inlineData: {
          data: att.data,
          mimeType: att.mimeType,
        }
      });
    });
  }

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: parts },
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 8000 }
    },
  });

  const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
    title: chunk.web?.title,
    uri: chunk.web?.uri,
  })).filter((s: any) => s.uri) || [];

  return {
    text: response.text || "기도문 생성 중 오류가 발생했습니다.",
    sources
  };
};
