
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { RepresentativeSettings, FuneralSettings, GroundingSource } from "../types";

// Always use process.env.API_KEY directly for initialization
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 특정 기도 섹션만 Google Search를 통해 독립적으로 검색 및 생성하는 함수
 */
export const generatePrayerSegment = async (
  segmentName: string, 
  context: { churchName: string; churchSeason: string; otherSeason?: string }
): Promise<string> => {
  const season = context.churchSeason === '기타' ? context.otherSeason : context.churchSeason;
  
  let segmentPrompt = "";
  
  if (segmentName.includes("찬양")) {
    segmentPrompt = `
      1. 최근 한국 교계에서 가장 은혜롭다고 평가받는 '${season}' 절기의 찬양 기도문을 검색하십시오.
      2. '${context.churchName}'의 이름이 가진 영적 의미나 해당 지역/교단에서 주로 사용하는 깊이 있는 찬양 표현을 분석하십시오.
      3. 성부, 성자, 성령 삼위일체 하나님에 대한 감사와 십자가의 보혈, 성령의 임재를 담은 '최고의 2~3문장'을 도출하십시오.
    `;
  } else if (segmentName.includes("참회")) {
    segmentPrompt = `
      1. 최근 한국 교계에서 가장 진실하고 통회하는 마음이 잘 표현된 '참회와 고백' 기도문을 검색하십시오.
      2. 성도들이 일상에서 겪는 연약함과 죄의 고백, 하나님의 자비를 구하는 깊이 있는 표현을 분석하십시오.
      3. 그리스도의 보혈로 씻음 받는 확신과 새로운 삶을 결단하는 '최고의 2~3문장'을 도출하십시오.
    `;
  } else if (segmentName.includes("나라")) {
    segmentPrompt = `
      1. 현재 대한민국이 처한 상황(경제, 사회, 안보 등)을 반영한 가장 적절하고 간절한 나라 사랑 기도문을 검색하십시오.
      2. 위정자들에게 필요한 성경적 지혜와 민족의 화합, 복음 통일을 향한 소망이 담긴 문구를 분석하십시오.
      3. 국가의 안위와 평화, 정의로운 사회를 간구하는 '최고의 2~3문장'을 도출하십시오.
    `;
  } else if (segmentName.includes("교회")) {
    segmentPrompt = `
      1. 한국 교회 부흥과 연합, 그리고 '${context.churchName}'와 같은 지역 교회의 사명을 다루는 현대적인 기도문을 검색하십시오.
      2. 교회의 영적 성장, 다음 세대의 부흥, 지역 사회를 향한 사랑의 실천을 강조하는 표현을 분석하십시오.
      3. 교회가 빛과 소금의 역할을 감당하도록 간구하는 '최고의 2~3문장'을 도출하십시오.
    `;
  } else if (segmentName.includes("고난") || segmentName.includes("치유")) {
    segmentPrompt = `
      1. 질병, 경제적 어려움, 심적 고통 중에 있는 성도들을 위로하는 가장 감동적인 치유 기도문을 검색하십시오.
      2. 여호와 라파의 하나님, 고난 중에 함께하시는 주님의 임재와 특별한 은혜를 구하는 표현을 분석하십시오.
      3. 아픈 이들의 육신과 영혼을 강건하게 하시는 하나님의 만져주심을 간구하는 '최고의 2~3문장'을 도출하십시오.
    `;
  } else if (segmentName.includes("설교자")) {
    segmentPrompt = `
      1. 말씀을 전하는 목회자에게 임하는 성령의 강력한 기름부으심을 간구하는 권능 있는 기도문을 검색하십시오.
      2. 선포되는 말씀이 성도들의 삶을 변화시키고 영적 갈급함을 채우는 생명의 양식이 되게 하는 표현을 분석하십시오.
      3. 설교자가 성령 충만하여 담대히 하나님의 진리를 선포하도록 돕는 '최고의 2~3문장'을 도출하십시오.
    `;
  }

  const prompt = `
    당신은 전 세계 기독교 문학 및 신학적 깊이가 가장 뛰어난 기도문 작성 전문가입니다.
    현재 '${context.churchName}'에서 드려지는 예배의 '${segmentName}' 파트를 위해, Google Search를 통해 다음 작업을 수행하세요:
    
    ${segmentPrompt}
    
    [작성 규칙]
    - 반드시 Google Search 결과를 바탕으로 기존에 없던 신선하고 깊은 영성의 문구를 작성하세요.
    - 문체는 격식 있고 장중한 '전통적 기도체'(~하옵소서, ~합니다)를 유지하세요.
    - 출력은 오직 기도 문구만 하고, 서론이나 결론은 생략하세요.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.9,
        thinkingConfig: { thinkingBudget: 2000 },
      },
    });

    return response.text?.trim() || "하나님의 은혜가 해당 영역 가운데 가득하시기를 소망합니다.";
  } catch (error) {
    console.error("Segment generation error:", error);
    return "하나님께서 우리 마음의 기도를 들으시고 가장 선한 것으로 채워주시기를 간절히 원합니다.";
  }
};

export const generateRepresentativePrayer = async (settings: RepresentativeSettings): Promise<{ text: string; sources: GroundingSource[] }> => {
  const toneInstruction = settings.prayerTone === '전통적' 
    ? "정통 한국 교회의 장중하고 격식 있는 문체(~하옵소서, ~하였사오니 등)를 사용하며, 깊은 영성과 경외심이 느껴지는 어휘를 선택하세요." 
    : "현대적이고 따뜻하며 진솔한 어조(~해주세요, ~합니다 등)를 사용하되, 예배의 거룩함과 경건함이 유지되는 고품격 문체로 작성하세요.";

  const finalServiceType = settings.serviceType === '기타' ? settings.otherServiceType : settings.serviceType;
  const finalChurchSeason = settings.churchSeason === '기타' ? settings.otherChurchSeason : settings.churchSeason;

  // 기침 구성 지침 동적 생성
  let instructionParts = "";
  if (settings.includeGraceAndSalvation) instructionParts += `- 경배와 찬양: ${settings.graceAndSalvation}\n`;
  if (settings.includeConfessionAndForgiveness) instructionParts += `- 참회와 고백: ${settings.confessionAndForgiveness}\n`;
  if (settings.includeNationWellbeing) instructionParts += `- 나라와 민족: ${settings.nationWellbeing}\n`;
  if (settings.includeChurchNeeds) instructionParts += `- 교회와 선교: ${settings.churchNeeds}\n`;
  if (settings.includeSpecialGraceAndHealing) instructionParts += `- 고난과 치유: ${settings.specialGraceAndHealing}\n`;
  if (settings.includePreacherFilling) instructionParts += `- 설교와 말씀: ${settings.preacherFilling}\n`;

  const prompt = `
    당신은 수십 년간 수많은 성도들에게 영적 감동을 전해온 세계 최고의 기도문 작성 전문가입니다. 
    Google Search와 제공된 멀티모달 정보를 활용하여 '최고의 대표기도문'을 작성해주세요.

    [핵심 임무]
    1. Google Search를 통해 현재 한국 교계의 '${finalChurchSeason}' 절기 및 '${finalServiceType}'에 가장 적절한 성경적 표현과 기도 흐름을 분석하십시오.
    2. [멀티모달 정밀 분석]: 제공된 첨부 파일(이미지, PDF, 문서 등)의 내용을 세밀하게 분석하십시오. 텍스트 정보나 현장의 분위기, 강조된 기도 제목 등을 모두 종합하여 기도문에 영적으로 승화시켜 반영하십시오.
    3. 각 섹션에 가장 잘 어울리는 성경 구절을 찾아 기도문에 자연스럽게 녹여내십시오.

    [입력 정보]
    - 교회 이름: ${settings.churchName}
    - 설교자: ${settings.pastorName} ${settings.pastorTitle}
    - 예배 종류: ${finalServiceType}
    - 교회 절기: ${finalChurchSeason}
    - 기도문 톤: ${settings.prayerTone} (${toneInstruction})
    - 예상 기도 시간: ${settings.prayerDuration}

    [기도문 구성 지침]
    ${instructionParts}
    - 추가 요청 사항: ${settings.additionalRequests}

    마지막은 "우리 주 예수 그리스도의 이름으로 간절히 기도드립니다. 아멘."으로 마무리하십시오.
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
    model: 'gemini-3-pro-preview',
    contents: { parts: parts },
    config: {
      tools: [{ googleSearch: {} }],
      temperature: 0.7,
      thinkingConfig: { thinkingBudget: 4000 },
    },
  });

  const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
    title: chunk.web?.title,
    uri: chunk.web?.uri,
  })).filter((s: any) => s.uri) || [];

  return {
    text: response.text || "최고의 기도문을 생성하는 데 실패했습니다.",
    sources
  };
};

export const generateFuneralPrayer = async (settings: FuneralSettings): Promise<{ text: string; sources: GroundingSource[] }> => {
  const prompt = `
    당신은 슬픔에 잠긴 이들을 위로하고 천국의 소망을 전하는 영적 위로자입니다.
    제공된 모든 정보를 바탕으로 '최고의 장례 예배 기도문'을 작성해주세요.

    [핵심 임무]
    1. Google Search를 통해 '${settings.funeralType}' 예배에 가장 적합한 위로와 소망의 성경 구절 및 정중한 기독교적 추모 용어를 검색하십시오.
    2. [멀티모달 정밀 분석]: 제공된 첨부 파일을 분석하여 고인의 생전 모습, 유가족과의 추억, 믿음의 흔적 등을 기도문에 따뜻하게 담아내어 위로하십시오.
    3. 부활의 산 소망과 영원한 안식을 간결하면서도 깊이 있게 표현하십시오.

    [세부 정보]
    - 고인: ${settings.deceasedName} ${settings.deceasedTitle}
    - 예배 구분: ${settings.funeralType} 예배
    - 유족 위로: ${settings.familyComfort}
    - 부활 소망: ${settings.hopeOfResurrection}
    - 추가 사항: ${settings.additionalRequests}

    마지막은 "부활이요 생명이신 예수 그리스도의 이름으로 기도드립니다. 아멘."으로 끝내주세요.
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
    model: 'gemini-3-pro-preview',
    contents: { parts: parts },
    config: {
      tools: [{ googleSearch: {} }],
      temperature: 0.6,
      thinkingConfig: { thinkingBudget: 4000 },
    },
  });

  const sources: GroundingSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
    title: chunk.web?.title,
    uri: chunk.web?.uri,
  })).filter((s: any) => s.uri) || [];

  return {
    text: response.text || "기도문을 생성하는 데 실패했습니다.",
    sources
  };
};

/**
 * 기도문을 음성으로 변환하는 함수
 */
export const generateSpeech = async (text: string, gender: 'male' | 'female' = 'female'): Promise<string> => {
  // Male: Puck, Female: Kore
  const voiceName = gender === 'male' ? 'Puck' : 'Kore';
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `차분하고 경건한 목소리로 다음 기도문을 낭독하세요: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Audio data not found");
    return base64Audio;
  } catch (error) {
    console.error("Speech generation error:", error);
    throw error;
  }
};
