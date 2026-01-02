
import React, { useState, useRef, useEffect } from 'react';
import { RepresentativeSettings, FuneralSettings, AppView, GroundingSource, PrayerAttachment, PrayerType } from './types';
import { generateRepresentativePrayer, generateFuneralPrayer, generatePrayerSegment } from './services/geminiService';

// --- Global helper declarations ---
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    // Fix: Remove readonly modifier to match existing declarations and prevent modifier conflict errors.
    aistudio: AIStudio;
  }
}

// --- Constants ---

const TITLES = ['목사', '장로', '권사', '집사', '성도', '교사', '선생님', '기타'];
const SERVICE_TYPES = ['주일 대예배', '주일 오후예배', '수요 예배', '금요 철야 예배', '새벽 기도회', '헌신 예배', '기타'];
const CHURCH_SEASONS = ['해당 없음', '대림절', '성탄절', '주현절', '사순절', '고난주간', '부활절', '성령강림절', '맥추감사절', '추수감사절', '종교개혁기념일', '기타'];
const MODEL_VERSION = "Gemini 3 Flash Preview";

const DEFAULT_REP_SETTINGS: RepresentativeSettings = {
  churchName: '',
  pastorName: '',
  pastorTitle: '목사',
  serviceType: '주일 대예배',
  otherServiceType: '',
  churchSeason: '해당 없음',
  otherChurchSeason: '',
  prayerTone: '현대적',
  prayerDuration: '3분',
  graceAndSalvation: '하나님의 크신 은혜와 독생자 예수 그리스도의 보혈로 우리를 구원하심을 찬양합니다.',
  confessionAndForgiveness: '지난 한 주간 주님 말씀대로 살지 못한 부족함을 고백합니다. 보혈로 씻어주소서.',
  nationWellbeing: '대한민국이 주님을 경외하는 나라 되게 하시고, 평화로운 통일의 길을 열어주소서.',
  churchNeeds: '저희 교회가 사랑으로 하나 되고, 잃어버린 영혼을 구원하는 방주가 되게 하소서.',
  specialGraceAndHealing: '병상에 있는 성도들과 가난하고 고통받는 이웃들에게 치유의 손길을 더하소서.',
  preacherFilling: '말씀을 전하시는 분께 성령의 두루마기를 입혀주셔서 생명의 말씀이 선포되게 하소서.',
  additionalRequests: '',
  attachments: []
};

const DEFAULT_FUN_SETTINGS: FuneralSettings = {
  deceasedName: '',
  deceasedTitle: '성도',
  funeralType: '발인',
  familyComfort: '사랑하는 가족을 먼저 보낸 유족들의 슬픔을 위로하여 주시고 성령의 평강을 허락하소서.',
  hopeOfResurrection: '우리가 다시 만날 부활의 산 소망을 주심에 감사합니다.',
  additionalRequests: '',
  attachments: []
};

// --- Sub-components ---

const AppSidebar: React.FC<{ activeView: AppView; setView: (v: AppView) => void; isDarkMode: boolean }> = ({ activeView, setView, isDarkMode }) => {
  const isRep = activeView === 'REP_SETTINGS' || activeView === 'REP_RESULT';
  const isFun = activeView === 'FUN_SETTINGS' || activeView === 'FUN_RESULT';

  return (
    <aside className={`hidden lg:flex w-64 border-r flex-col h-full transition-colors duration-300 no-print ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-stone-100 border-stone-200'}`}>
      <div className={`p-6 border-b ${isDarkMode ? 'border-stone-800' : 'border-stone-200'}`}>
        <h1 className={`text-2xl font-bold flex items-center gap-2 ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>
          <span className="text-amber-600">✝</span> 은혜의 기도
        </h1>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <button
          onClick={() => setView('REP_SETTINGS')}
          className={`w-full text-left px-4 py-3 rounded-lg transition-all ${isRep ? 'bg-amber-600/20 text-amber-500 font-bold' : isDarkMode ? 'text-stone-400 hover:bg-stone-800' : 'text-stone-600 hover:bg-stone-200'}`}
        >
          대표기도 설정 & 생성
        </button>
        <div className={`my-2 border-t mx-2 ${isDarkMode ? 'border-stone-800' : 'border-stone-200'}`}></div>
        <button
          onClick={() => setView('FUN_SETTINGS')}
          className={`w-full text-left px-4 py-3 rounded-lg transition-all ${isFun ? 'bg-amber-600/20 text-amber-500 font-bold' : isDarkMode ? 'text-stone-400 hover:bg-stone-800' : 'text-stone-600 hover:bg-stone-200'}`}
        >
          장례기도 설정 & 생성
        </button>
      </nav>
      <div className={`p-4 text-center border-t ${isDarkMode ? 'border-stone-800 text-stone-600' : 'border-stone-200 text-stone-400'}`}>
        <p className="text-[10px] font-medium tracking-widest uppercase">{MODEL_VERSION}</p>
      </div>
    </aside>
  );
};

const AppBottomMenu: React.FC<{ activeView: AppView; setView: (v: AppView) => void; isDarkMode: boolean }> = ({ activeView, setView, isDarkMode }) => {
  const isRep = activeView === 'REP_SETTINGS' || activeView === 'REP_RESULT';
  const isFun = activeView === 'FUN_SETTINGS' || activeView === 'FUN_RESULT';

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-20 border-t backdrop-blur-lg no-print transition-colors duration-300 ${isDarkMode ? 'bg-stone-950/90 border-stone-800 text-stone-400' : 'bg-white/90 border-stone-200 text-stone-600'}`}>
      <button 
        onClick={() => setView('REP_SETTINGS')}
        className={`flex flex-col items-center justify-center flex-1 h-full transition-all ${isRep ? 'text-amber-600 font-bold scale-105' : 'hover:text-amber-500'}`}
      >
        <span className="text-2xl mb-1">⛪</span>
        <span className="text-xs">대표기도</span>
      </button>
      <div className={`w-px h-10 ${isDarkMode ? 'bg-stone-800' : 'bg-stone-200'}`}></div>
      <button 
        onClick={() => setView('FUN_SETTINGS')}
        className={`flex flex-col items-center justify-center flex-1 h-full transition-all ${isFun ? 'text-amber-600 font-bold scale-105' : 'hover:text-amber-500'}`}
      >
        <span className="text-2xl mb-1">🌹</span>
        <span className="text-xs">장례기도</span>
      </button>
    </div>
  );
};

interface AccordionFieldProps {
  index: number;
  label: string;
  value: string;
  isOpen: boolean;
  onAccordionToggle: () => void;
  onValueUpdate: (v: string) => void;
  isDarkMode: boolean;
  onAutoSearch?: () => void;
  isSearchingInProgress?: boolean;
  enableMic?: boolean;
  onValueClear?: () => void;
}

const AccordionField: React.FC<AccordionFieldProps> = ({ 
  index, label, value, isOpen, onAccordionToggle, onValueUpdate, isDarkMode, onAutoSearch, isSearchingInProgress, enableMic, onValueClear 
}) => {
  const [isMicActive, setIsMicActive] = useState(false);
  const recognitionInstance = useRef<any>(null);

  const triggerSpeechInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMicActive && recognitionInstance.current) {
      recognitionInstance.current.abort();
      setIsMicActive(false);
      return;
    }
    const SpeechRecog = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecog) {
      alert("이 브라우저에서는 음성 인식을 지원하지 않습니다.");
      return;
    }
    const recognition = new SpeechRecog();
    recognitionInstance.current = recognition;
    recognition.lang = 'ko-KR';
    recognition.onstart = () => setIsMicActive(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const combined = value && value.trim().length > 0 ? `${value.trim()} ${transcript}` : transcript;
      onValueUpdate(combined);
      setIsMicActive(false);
    };
    recognition.onerror = () => setIsMicActive(false);
    recognition.onend = () => setIsMicActive(false);
    recognition.start();
  };

  return (
    <div className={`mb-3 border rounded-xl overflow-hidden transition-all duration-300 ${isDarkMode ? 'border-stone-800 bg-stone-900' : 'border-stone-200 bg-white'} ${isOpen ? 'ring-1 ring-amber-500/50 shadow-md' : ''}`}>
      <div className={`flex items-center transition-colors ${isOpen ? (isDarkMode ? 'bg-amber-900/10' : 'bg-amber-50') : ''}`}>
        <button
          onClick={onAccordionToggle}
          className="flex-1 flex items-center justify-between p-4 text-left transition-colors overflow-hidden"
        >
          <div className="flex items-center gap-3 min-w-0 mr-2">
            <span className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${isOpen ? 'bg-amber-600 text-white' : (isDarkMode ? 'bg-stone-800 text-stone-500' : 'bg-stone-100 text-stone-400')}`}>
              {index}
            </span>
            <span className={`font-medium truncate ${isDarkMode ? (isOpen ? 'text-amber-400' : 'text-stone-300') : (isOpen ? 'text-amber-700' : 'text-stone-700')}`}>
              {label}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {isOpen && enableMic && (
              <button
                type="button"
                onClick={triggerSpeechInput}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[11px] font-bold border whitespace-nowrap shadow-sm ${isMicActive ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse' : (isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-400 hover:text-amber-500 hover:border-amber-900/50' : 'bg-white border-stone-200 text-stone-600 hover:text-amber-600 hover:bg-amber-50')}`}
              >
                {isMicActive ? "인식 중 (종료)" : "🎤 음성 입력"}
              </button>
            )}
            <svg className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180 text-amber-500' : 'text-stone-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        {isOpen && onAutoSearch && (
          <div className="flex items-center gap-2 mr-4 flex-shrink-0">
            {isSearchingInProgress ? (
              <span className={`text-xs font-bold flex items-center gap-1.5 animate-pulse ${isDarkMode ? 'text-amber-500' : 'text-amber-600'}`}>
                검색 중...
              </span>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onAutoSearch(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 ${isDarkMode ? 'bg-stone-800 text-amber-400 border border-amber-900/30' : 'bg-white text-amber-600 border border-amber-200 shadow-sm hover:bg-amber-50'}`}
              >
                ✨ AI 추천
              </button>
            )}
          </div>
        )}
      </div>
      <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100 p-4 pt-0' : 'max-h-0 opacity-0'}`}>
        <textarea
          value={value}
          onChange={(e) => onValueUpdate(e.target.value)}
          className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all min-h-[120px] ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-200 text-stone-800'}`}
          placeholder={`${label}에 대한 기도 제목을 입력하세요.`}
        />
      </div>
    </div>
  );
};

const CustomFormField: React.FC<any> = ({ label, value, onValueUpdate, placeholder, fieldType = 'textarea', isDarkMode, useMic }) => {
  const recognitionInstance = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);

  const handleSpeech = () => {
    if (isListening && recognitionInstance.current) {
      recognitionInstance.current.abort();
      setIsListening(false);
      return;
    }
    const SpeechRecog = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecog) return;
    const recognition = new SpeechRecog();
    recognitionInstance.current = recognition;
    recognition.lang = 'ko-KR';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onValueUpdate(value ? `${value} ${transcript}` : transcript);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <label className={`block text-sm font-medium ${isDarkMode ? 'text-stone-400' : 'text-stone-700'}`}>{label}</label>
        {useMic && (
          <button type="button" onClick={handleSpeech} className={`text-[10px] font-bold px-2 py-1 rounded border transition-all ${isListening ? 'bg-red-500 text-white' : (isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-400' : 'bg-stone-100 border-stone-200 text-stone-600')}`}>
            🎤 {isListening ? "인식 중" : "음성"}
          </button>
        )}
      </div>
      {fieldType === 'textarea' ? (
        <textarea value={value} onChange={(e) => onValueUpdate(e.target.value)} className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all min-h-[120px] ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-200 text-stone-800'}`} placeholder={placeholder} />
      ) : (
        <input type="text" value={value} onChange={(e) => onValueUpdate(e.target.value)} className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-200 text-stone-800'}`} placeholder={placeholder} />
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('REP_SETTINGS');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchStatus, setSearchStatus] = useState<Record<number, boolean>>({});
  const [resultPrayer, setResultPrayer] = useState('');
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);
  const [darkModeActive, setDarkModeActive] = useState(true);
  const [activeAccordion, setActiveAccordion] = useState<number | null>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const [repData, setRepData] = useState<RepresentativeSettings>(DEFAULT_REP_SETTINGS);
  const [funData, setFunData] = useState<FuneralSettings>(DEFAULT_FUN_SETTINGS);

  const fsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkKey();
  }, []);

  const submitRepPrayer = async () => {
    setIsProcessing(true);
    try {
      const res = await generateRepresentativePrayer(repData);
      setResultPrayer(res.text);
      setGroundingSources(res.sources);
      setCurrentView('REP_RESULT');
    } finally { setIsProcessing(false); }
  };

  const submitFunPrayer = async () => {
    setIsProcessing(true);
    try {
      const res = await generateFuneralPrayer(funData);
      setResultPrayer(res.text);
      setGroundingSources(res.sources);
      setCurrentView('FUN_RESULT');
    } finally { setIsProcessing(false); }
  };

  const ApiKeyBanner = () => (
    <div className={`no-print w-full py-3 px-6 flex flex-wrap items-center justify-center gap-4 text-xs font-bold border-b transition-colors shadow-sm ${darkModeActive ? 'bg-stone-900 border-stone-800 text-stone-400' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-green-500' : 'bg-red-500'}`}></span>
        <span>{hasApiKey ? "Gemini API 키가 연결되었습니다." : "기도 생성을 위해 API 키 설정이 필요합니다."}</span>
      </div>
      <button 
        onClick={async () => {
          await window.aistudio.openSelectKey();
          // Assume the key selection was successful as per instructions to avoid race conditions.
          setHasApiKey(true);
        }}
        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-1"
      >
        🔑 API 키 관리 및 설정
      </button>
      <span className="opacity-60 hidden sm:inline">| 설정된 키는 PC와 모바일에 안전하게 자동 저장됩니다. | <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline">결제 안내</a></span>
    </div>
  );

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-300 ${darkModeActive ? 'bg-stone-950 text-stone-200' : 'bg-stone-50 text-stone-800'}`}>
      <ApiKeyBanner />
      
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        <AppSidebar activeView={currentView} setView={setCurrentView} isDarkMode={darkModeActive} />
        
        <main className="flex-1 p-4 md:p-8 overflow-y-auto pb-24 lg:pb-8">
          <div className="flex justify-between items-center mb-8 no-print">
             <h1 className="text-xl font-bold lg:hidden serif-font text-amber-600">✝ 은혜의 기도</h1>
             <button onClick={() => setDarkModeActive(!darkModeActive)} className={`p-2 rounded-full border ${darkModeActive ? 'bg-stone-800 border-stone-700 text-amber-400' : 'bg-white border-stone-200 text-stone-600'}`}>
               {darkModeActive ? "☀️ Light" : "🌙 Dark"}
             </button>
          </div>

          {isProcessing ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[50vh]">
              <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-6"></div>
              <p className="text-xl font-bold serif-font text-amber-500 animate-pulse text-center">성령의 감동을 따라 은혜로운 기도문을 작성하고 있습니다...</p>
            </div>
          ) : currentView === 'REP_SETTINGS' ? (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold serif-font mb-8 border-b-2 border-amber-600 pb-2 inline-block">대표기도 설정</h2>
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <CustomFormField label="교회 이름" fieldType="input" value={repData.churchName} onValueUpdate={(v: any) => setRepData(p => ({ ...p, churchName: v }))} isDarkMode={darkModeActive} useMic />
                <CustomFormField label="설교자 성함" fieldType="input" value={repData.pastorName} onValueUpdate={(v: any) => setRepData(p => ({ ...p, pastorName: v }))} isDarkMode={darkModeActive} useMic />
              </div>
              <div className="space-y-3 mb-10">
                {[
                  { i: 1, l: "찬양과 감사 (하나님의 은혜)", k: "graceAndSalvation" as const },
                  { i: 2, l: "참회와 회개 (십자가의 보혈)", k: "confessionAndForgiveness" as const },
                  { i: 3, l: "나라와 민족", k: "nationWellbeing" as const },
                  { i: 4, l: "교회와 선교", k: "churchNeeds" as const },
                  { i: 5, l: "성도의 환우와 치유", k: "specialGraceAndHealing" as const },
                  { i: 6, l: "설교자와 생명의 말씀", k: "preacherFilling" as const }
                ].map(item => (
                  <AccordionField key={item.i} index={item.i} label={item.l} value={repData[item.k]} isOpen={activeAccordion === item.i} onAccordionToggle={() => setActiveAccordion(activeAccordion === item.i ? null : item.i)} onValueUpdate={(v) => setRepData(p => ({ ...p, [item.k]: v }))} isDarkMode={darkModeActive} onAutoSearch={async () => {
                    if (!repData.churchName) { alert("교회 이름을 먼저 입력해주세요."); return; }
                    setSearchStatus(prev => ({ ...prev, [item.i]: true }));
                    try {
                      const res = await generatePrayerSegment(item.l, { churchName: repData.churchName, churchSeason: repData.churchSeason });
                      setRepData(p => ({ ...p, [item.k]: res }));
                    } finally { setSearchStatus(prev => ({ ...prev, [item.i]: false })); }
                  }} isSearchingInProgress={searchStatus[item.i]} enableMic />
                ))}
              </div>
              <button onClick={submitRepPrayer} disabled={!hasApiKey} className={`w-full font-bold py-5 rounded-xl shadow-xl transition-all active:scale-95 text-lg serif-font ${!hasApiKey ? 'bg-stone-700 text-stone-500 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}>
                {hasApiKey ? "대표기도문 생성하기" : "API 키를 먼저 설정해주세요"}
              </button>
            </div>
          ) : currentView === 'FUN_SETTINGS' ? (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold serif-font mb-8 border-b-2 border-amber-600 pb-2 inline-block">장례기도 설정</h2>
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                <CustomFormField label="고인의 성함" fieldType="input" value={funData.deceasedName} onValueUpdate={(v: any) => setFunData(p => ({ ...p, deceasedName: v }))} isDarkMode={darkModeActive} useMic />
                <CustomFormField label="직분/호칭" fieldType="input" value={funData.deceasedTitle} onValueUpdate={(v: any) => setFunData(p => ({ ...p, deceasedTitle: v }))} isDarkMode={darkModeActive} useMic />
              </div>
              <CustomFormField label="유족을 위한 위로 (하나님의 긍휼)" value={funData.familyComfort} onValueUpdate={(v: any) => setFunData(p => ({ ...p, familyComfort: v }))} isDarkMode={darkModeActive} useMic />
              <CustomFormField label="부활의 산 소망" value={funData.hopeOfResurrection} onValueUpdate={(v: any) => setFunData(p => ({ ...p, hopeOfResurrection: v }))} isDarkMode={darkModeActive} useMic />
              <button onClick={submitFunPrayer} disabled={!hasApiKey} className={`w-full font-bold py-5 rounded-xl shadow-xl transition-all active:scale-95 text-lg serif-font ${!hasApiKey ? 'bg-stone-700 text-stone-500 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}>
                {hasApiKey ? "장례기도문 생성하기" : "API 키를 먼저 설정해주세요"}
              </button>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-6 no-print">
                <h2 className="text-2xl font-bold serif-font">완성된 기도문</h2>
                <div className="flex gap-2">
                   <button onClick={() => { navigator.clipboard.writeText(resultPrayer); alert("복사되었습니다."); }} className="px-4 py-2 bg-stone-800 border border-stone-700 rounded-lg text-sm">복사</button>
                   <button onClick={() => window.print()} className="px-4 py-2 bg-stone-800 border border-stone-700 rounded-lg text-sm">인쇄</button>
                </div>
              </div>
              <div className={`p-8 md:p-12 rounded-2xl border shadow-lg whitespace-pre-wrap leading-relaxed serif-font text-lg ${darkModeActive ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}>
                {resultPrayer}
              </div>
              {groundingSources.length > 0 && (
                <div className="mt-8 pt-6 border-t border-stone-800">
                  <h3 className="text-sm font-bold text-amber-500 mb-4">참고한 말씀 및 출처</h3>
                  <div className="flex flex-wrap gap-2">
                    {groundingSources.map((s, i) => (
                      <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-stone-800 border border-stone-700 rounded-full text-[11px] hover:text-amber-400">
                        {s.title || '출처'} 🔗
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="lg:hidden h-24"></div>
          <div className={`mt-12 text-center no-print ${darkModeActive ? 'text-stone-700' : 'text-stone-300'}`}>
            <p className="text-[10px] font-medium tracking-widest uppercase">{MODEL_VERSION}</p>
          </div>
        </main>
      </div>
      <AppBottomMenu activeView={currentView} setView={setCurrentView} isDarkMode={darkModeActive} />
    </div>
  );
};

export default App;
