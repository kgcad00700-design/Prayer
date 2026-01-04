
import React, { useState, useRef, useEffect } from 'react';
import { RepresentativeSettings, FuneralSettings, AppView, GroundingSource, PrayerAttachment } from './types';
import { generateRepresentativePrayer, generateFuneralPrayer, generatePrayerSegment, generateSpeech } from './services/geminiService';

// --- Helper Functions for Audio ---
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Creates a WAV file blob from raw PCM data
 */
function createWavBlob(pcmData: Uint8Array, sampleRate: number): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  // file length
  view.setUint32(4, 36 + pcmData.length, true);
  // RIFF type
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // format chunk identifier
  view.setUint32(12, 0x666d7420, false); // "fmt "
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true); // PCM
  // channel count
  view.setUint16(22, 1, true); // Mono
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  view.setUint32(36, 0x64617461, false); // "data"
  // data chunk length
  view.setUint32(40, pcmData.length, true);

  return new Blob([header, pcmData], { type: 'audio/wav' });
}

// --- Constants ---

const TITLES = ['목사', '장로', '권사', '집사', '성도', '교사', '선생님', '기타'];
const PRAYER_TONES = ['전통적', '현대적'];
const PRAYER_DURATIONS = ['2분', '3분', '4분', '5분'];
const SERVICE_TYPES = ['주일 대예배', '주일 오후예배', '수요 예배', '금요 철야 예배', '새벽 기도회', '헌신 예배', '기타'];
const CHURCH_SEASONS = ['해당 없음', '대림절', '성탄절', '주현절', '사순절', '고난주간', '부활절', '성령강림절', '맥추감사절', '추수감사절', '종교개혁기념일', '기타'];

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
  includeGraceAndSalvation: true,
  confessionAndForgiveness: '지난 한 주간 주님 말씀대로 살지 못한 부족함을 고백합니다. 보혈로 씻어주소서.',
  includeConfessionAndForgiveness: true,
  nationWellbeing: '대한민국이 주님을 경외하는 나라 되게 하시고, 평화로운 통일의 길을 열어주소서.',
  includeNationWellbeing: true,
  churchNeeds: '저희 교회가 사랑으로 하나 되고, 잃어버린 영혼을 구원하는 방주가 되게 하소서.',
  includeChurchNeeds: true,
  specialGraceAndHealing: '병상에 있는 성도들과 가난하고 고통받는 이웃들에게 치유의 손길을 더하소서.',
  includeSpecialGraceAndHealing: true,
  preacherFilling: '말씀을 전하시는 분께 성령의 두루마기를 입혀주셔서 생명의 말씀이 선포되게 하소서.',
  includePreacherFilling: true,
  additionalRequests: '',
  voiceGender: 'female',
  attachments: []
};

const DEFAULT_FUN_SETTINGS: FuneralSettings = {
  deceasedName: '',
  deceasedTitle: '성도',
  funeralType: '발인',
  familyComfort: '사랑하는 가족을 먼저 보낸 유족들의 슬픔을 위로하여 주시고 성령의 평강을 허락하소서.',
  hopeOfResurrection: '우리가 다시 만날 부활의 산 소망을 주심에 감사합니다.',
  additionalRequests: '',
  voiceGender: 'female',
  attachments: []
};

// --- Sub-components ---

const Sidebar: React.FC<{ activeView: AppView; setView: (v: AppView) => void; isDarkMode: boolean }> = ({ activeView, setView, isDarkMode }) => {
  const isRep = activeView === 'REP_SETTINGS' || activeView === 'REP_RESULT';
  const isFun = activeView === 'FUN_SETTINGS' || activeView === 'FUN_RESULT';

  return (
    <aside className={`w-full lg:w-64 border-r flex flex-col h-full transition-colors duration-300 no-print ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-stone-100 border-stone-200'}`}>
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
    </aside>
  );
};

const ThemeToggle: React.FC<{ isDarkMode: boolean; toggle: () => void }> = ({ isDarkMode, toggle }) => (
  <button
    onClick={toggle}
    className={`p-2 rounded-full transition-all flex items-center gap-2 px-4 py-2 text-sm font-medium border no-print ${isDarkMode ? 'bg-stone-800 border-stone-700 text-amber-400' : 'bg-white border-stone-200 text-stone-600 shadow-sm'}`}
  >
    {isDarkMode ? (
      <>
        <span className="text-lg">☀️</span> 라이트 모드
      </>
    ) : (
      <>
        <span className="text-lg">🌙</span> 다크 모드
      </>
    )}
  </button>
);

const AccordionField: React.FC<{
  index: number;
  label: string;
  value: string;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
  isDarkMode: boolean;
  onSearch?: () => void;
  onCancelSearch?: () => void;
  isSearching?: boolean;
  isEnabled: boolean;
  onToggleEnabled: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ index, label, value, isOpen, onToggle, onChange, isDarkMode, onSearch, onCancelSearch, isSearching, isEnabled, onToggleEnabled }) => {
  return (
    <div className={`mb-3 border rounded-xl overflow-hidden transition-all duration-300 ${isDarkMode ? 'border-stone-800 bg-stone-900' : 'border-stone-200 bg-white'} ${isOpen ? 'ring-1 ring-amber-500/50' : ''} ${!isEnabled ? 'opacity-60' : ''}`}>
      <div className={`flex items-center transition-colors ${isOpen ? (isDarkMode ? 'bg-amber-900/10' : 'bg-amber-50') : ''}`}>
        <div className="pl-4 flex items-center">
            <input 
                type="checkbox" 
                checked={isEnabled} 
                onChange={onToggleEnabled}
                className="w-5 h-5 rounded border-stone-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                title={`${label} 포함 여부`}
            />
        </div>
        <button
          onClick={onToggle}
          disabled={!isEnabled}
          className="flex-1 flex items-center justify-between p-4 text-left transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${isOpen ? 'bg-amber-600 text-white' : (isDarkMode ? 'bg-stone-800 text-stone-500' : 'bg-stone-100 text-stone-400')}`}>
              {index}
            </span>
            <span className={`font-medium ${isDarkMode ? (isOpen ? 'text-amber-400' : 'text-stone-300') : (isOpen ? 'text-amber-700' : 'text-stone-700')}`}>
              {label}
            </span>
          </div>
          <svg 
            className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180 text-amber-500' : 'text-stone-400'}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isEnabled && isOpen && onSearch && (
          <div className="flex items-center gap-2 mr-4">
            {isSearching ? (
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold flex items-center gap-1.5 animate-pulse ${isDarkMode ? 'text-amber-500' : 'text-amber-600'}`}>
                  <div className="w-2.5 h-2.5 border-2 border-t-transparent border-current rounded-full animate-spin"></div>
                  검색 중...
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelSearch?.();
                  }}
                  className={`px-2 py-1 rounded border text-[10px] font-bold transition-all active:scale-95 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-400 hover:text-red-400' : 'bg-white border-stone-200 text-stone-500 hover:text-red-600 hover:bg-red-50'}`}
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSearch();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 ${isDarkMode ? 'bg-stone-800 text-amber-400 border border-amber-900/30' : 'bg-white text-amber-600 border border-amber-200 shadow-sm hover:bg-amber-50'}`}
              >
                <span>✨</span> 다시 검색
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className={`transition-all duration-300 ease-in-out ${isEnabled && isOpen ? 'max-h-96 opacity-100 p-4 pt-0' : 'max-h-0 opacity-0'}`}>
        <textarea
          value={value}
          disabled={!isEnabled}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all min-h-[120px] ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-200 text-stone-800'}`}
          placeholder={`${label}에 대한 구체적인 내용을 입력하세요.`}
        />
      </div>
    </div>
  );
};

const FormField: React.FC<{ 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  placeholder?: string; 
  type?: string;
  onClear?: () => void;
  onClearAttachments?: () => void;
  error?: boolean;
  inputRef?: React.RefObject<any>;
  isDarkMode: boolean;
  onAttachment?: (data: string, mimeType: string, fileName: string) => void;
  onImageRemove?: (index: number) => void;
  attachedImages?: PrayerAttachment[];
  onSpeech?: () => void;
  isListening?: boolean;
}> = ({ label, value, onChange, placeholder, type = 'textarea', onClear, onClearAttachments, error, inputRef, isDarkMode, onAttachment, onImageRemove, attachedImages = [], onSpeech, isListening }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const baseClasses = `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all`;
  const themeClasses = isDarkMode 
    ? `bg-stone-800 border-stone-700 text-stone-200 placeholder-stone-500` 
    : `bg-white border-stone-300 text-stone-800 placeholder-stone-400`;
  const errorClasses = error ? 'border-red-500 bg-red-50/10' : '';
  const draggingClasses = isDragging ? (isDarkMode ? 'border-amber-500 ring-2 ring-amber-500/50 bg-stone-700/50' : 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-50/50') : '';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && onAttachment) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result === 'string') {
            const base64 = result.split(',')[1];
            onAttachment(base64, file.type, file.name);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!onAttachment) return;
    
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result;
              if (typeof result === 'string') {
                const base64 = result.split(',')[1];
                onAttachment(base64, file.type, `pasted_image_${Date.now()}.png`);
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!onAttachment) return;
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!onAttachment) return;
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!onAttachment) return;
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result === 'string') {
            const base64 = result.split(',')[1];
            onAttachment(base64, file.type, file.name);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <label className={`block text-sm font-medium ${isDarkMode ? 'text-stone-400' : 'text-stone-700'}`}>{label}</label>
        {onAttachment && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`text-xs flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all ${isDarkMode ? 'bg-stone-900 border-stone-700 text-stone-400 hover:text-amber-500 hover:border-amber-900/50' : 'bg-stone-50 border-stone-200 text-stone-500 hover:text-amber-600 hover:bg-amber-50'}`}
            >
              <span>📎</span> 파일 추가
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
            />
          </div>
        )}
      </div>

      {attachedImages.length > 0 && (
        <div className="mb-4">
           <div className="flex justify-between items-center mb-2 px-1">
             <div className="text-[10px] text-amber-600 font-bold">첨부된 파일: {attachedImages.length}개</div>
             {onClearAttachments && (
               <button 
                 type="button" 
                 onClick={onClearAttachments}
                 className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${isDarkMode ? 'border-red-900/50 text-red-500 hover:bg-red-500/10' : 'border-red-200 text-red-600 hover:bg-red-50'}`}
               >
                 전체 파일 삭제 🗑️
               </button>
             )}
           </div>
          <div className="flex flex-wrap gap-3">
            {attachedImages.map((img, idx) => (
              <div key={idx} className="relative inline-block group">
                {img.mimeType.startsWith('image/') ? (
                  <img 
                    src={`data:${img.mimeType};base64,${img.data}`} 
                    alt={img.fileName || `첨부 이미지 ${idx + 1}`} 
                    className="w-24 h-24 object-cover rounded-lg border-2 border-amber-500/50 shadow-sm"
                  />
                ) : (
                  <div className={`w-24 h-24 rounded-lg border-2 border-stone-400/50 flex flex-col items-center justify-center p-2 text-center transition-colors ${isDarkMode ? 'bg-stone-800' : 'bg-stone-50'}`}>
                    <span className="text-2xl mb-1">📄</span>
                    <span className={`text-[10px] font-medium truncate w-full ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>{img.fileName || '문서 파일'}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                   <button
                    type="button"
                    onClick={() => onImageRemove?.(idx)}
                    className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {type === 'textarea' ? (
        <div className="relative group/text">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={handlePaste}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`${baseClasses} ${themeClasses} ${errorClasses} ${draggingClasses} min-h-[120px]`}
            placeholder={onAttachment ? `${placeholder}\n(여기에 파일을 드래그 앤 드롭하거나, 이미지를 Ctrl+V로 붙여넣으실 수 있습니다.)` : placeholder}
          />
          {onClear && value && (
            <button 
              type="button" 
              onClick={onClear}
              className={`absolute top-2 right-2 p-1.5 rounded-md text-[10px] font-bold opacity-0 group-hover/text:opacity-100 transition-all ${isDarkMode ? 'bg-stone-900/80 text-stone-400 hover:text-stone-100' : 'bg-stone-100/80 text-stone-500 hover:text-stone-800'}`}
            >
              내용 삭제 ✕
            </button>
          )}
          {onSpeech && (
            <button
              type="button"
              onClick={onSpeech}
              className={`absolute bottom-2 right-2 p-2 rounded-full transition-all shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse' : (isDarkMode ? 'bg-stone-700 text-stone-300 hover:text-amber-500' : 'bg-stone-100 text-stone-500 hover:text-amber-600')}`}
              title="음성으로 입력하기"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 00-2 0 7.001 7.001 0 005 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={handlePaste}
            className={`${baseClasses} ${themeClasses} ${errorClasses}`}
            placeholder={placeholder}
          />
        </div>
      )}
      <div className="flex justify-between items-start mt-1 px-1 min-h-[1.25rem]">
        <div>
          {error && <p className="text-xs text-red-500 font-medium">이 항목은 필수 입력입니다.</p>}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('REP_SETTINGS');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPreparingSpeech, setIsPreparingSpeech] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isListeningSTT, setIsListeningSTT] = useState(false);
  const [searchingStates, setSearchingStates] = useState<Record<number, boolean>>({
    1: false, 2: false, 3: false, 4: false, 5: false, 6: false
  });
  const activeRequestsRef = useRef<Record<number, number>>({});
  const speechRequestRef = useRef<number>(0);
  const downloadRequestRef = useRef<number>(0);

  const [generatedPrayer, setGeneratedPrayer] = useState('');
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [openAccordionIndex, setOpenAccordionIndex] = useState<number | null>(null);

  const churchNameRef = useRef<HTMLInputElement>(null);
  const pastorNameRef = useRef<HTMLInputElement>(null);
  const deceasedNameRef = useRef<HTMLInputElement>(null);
  const settingSectionRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [repSettings, setRepSettings] = useState<RepresentativeSettings>({...DEFAULT_REP_SETTINGS, attachments: []});
  const [funSettings, setFunSettings] = useState<FuneralSettings>({...DEFAULT_FUN_SETTINGS, attachments: []});

  const validateRepFields = () => {
    // '기타' 예배 종류일 때는 교회 이름과 설교자 정보가 비어있어도 허용
    if (repSettings.serviceType === '기타') {
        return repSettings.otherServiceType.trim().length > 0;
    }
    return (
      repSettings.churchName.trim() && 
      repSettings.pastorName.trim() &&
      (repSettings.churchSeason !== '기타' || repSettings.otherChurchSeason.trim())
    );
  };

  const handleSearchSegment = async (index: number) => {
    if (!validateRepFields()) {
      setAttemptedSubmit(true);
      alert("다시 검색을 위해 필수 설정을 먼저 완료해 주세요.");
      settingSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    
    const labels: Record<number, string> = {
      1: '찬양과 감사 (성부/성자/성령)',
      2: '참회와 고백 (한 주간의 죄 회개와 용서)',
      3: '나라와 민족의 안위 (위정자)',
      4: '교회와 선교의 필요 (부흥과 하나됨)',
      5: '성도들의 고난과 치유 (하나님의 특별 은혜)',
      6: '설교자를 위한 간구 (성령 충만)'
    };

    const keys: Record<number, keyof RepresentativeSettings> = {
      1: 'graceAndSalvation',
      2: 'confessionAndForgiveness',
      3: 'nationWellbeing',
      4: 'churchNeeds',
      5: 'specialGraceAndHealing',
      6: 'preacherFilling'
    };

    const requestId = Date.now();
    activeRequestsRef.current[index] = requestId;
    setSearchingStates(prev => ({ ...prev, [index]: true }));

    try {
      const newPhrase = await generatePrayerSegment(labels[index], {
        churchName: repSettings.churchName,
        churchSeason: repSettings.churchSeason,
        otherSeason: repSettings.otherChurchSeason
      });
      if (activeRequestsRef.current[index] !== requestId) return;
      setRepSettings(prev => ({ ...prev, [keys[index]]: newPhrase }));
    } catch (error) {
      if (activeRequestsRef.current[index] === requestId) {
        alert("영적 문구를 검색하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      if (activeRequestsRef.current[index] === requestId) {
        setSearchingStates(prev => ({ ...prev, [index]: false }));
      }
    }
  };

  const handleCancelSearchSegment = (index: number) => {
    activeRequestsRef.current[index] = 0;
    setSearchingStates(prev => ({ ...prev, [index]: false }));
  };

  const handleGenerateRep = async () => {
    setAttemptedSubmit(true);
    
    // 유효성 검사 logic 수정
    if (repSettings.serviceType !== '기타') {
        if (!repSettings.churchName) {
            alert("교회 이름을 입력해주세요.");
            churchNameRef.current?.focus();
            return;
        }
        if (!repSettings.pastorName) {
            alert("설교자 성함을 입력해주세요.");
            pastorNameRef.current?.focus();
            return;
        }
    } else {
        if (!repSettings.otherServiceType) {
            alert("예배 종류를 직접 입력해주세요.");
            return;
        }
    }

    setIsLoading(true);
    try {
      const result = await generateRepresentativePrayer(repSettings);
      setGeneratedPrayer(result.text);
      setSources(result.sources);
      setView('REP_RESULT');
      setAttemptedSubmit(false);
    } catch (error) {
      alert("기도문 생성 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetRep = () => {
    if (window.confirm("입력한 모든 내용과 첨부 파일이 초기화됩니다. 계속하시겠습니까?")) {
      setRepSettings({
        ...DEFAULT_REP_SETTINGS,
        attachments: []
      });
      setAttemptedSubmit(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGenerateFun = async () => {
    setAttemptedSubmit(true);
    if (!funSettings.deceasedName) {
      alert("고인의 이름을 입력해주세요.");
      deceasedNameRef.current?.focus();
      return;
    }
    setIsLoading(true);
    try {
      const result = await generateFuneralPrayer(funSettings);
      setGeneratedPrayer(result.text);
      setSources(result.sources);
      setView('FUN_RESULT');
      setAttemptedSubmit(false);
    } catch (error) {
      alert("기도문 생성 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFun = () => {
    if (window.confirm("입력한 모든 내용과 첨부 파일이 초기화됩니다. 계속하시겠습니까?")) {
      setFunSettings({
        ...DEFAULT_FUN_SETTINGS,
        attachments: []
      });
      setAttemptedSubmit(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRegenerate = () => {
    stopSpeech();
    if (view === 'REP_RESULT') handleGenerateRep();
    else if (view === 'FUN_RESULT') handleGenerateFun();
  };

  const changeView = (newView: AppView) => {
    stopSpeech();
    setAttemptedSubmit(false);
    setView(newView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelLoading = () => setIsLoading(false);

  // --- Speech Recognition (STT) Logic ---
  const handleStartSTT = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("이 브라우저는 음성 인식을 지원하지 않습니다.");
      return;
    }

    if (isListeningSTT) {
      setIsListeningSTT(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListeningSTT(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setFunSettings(prev => ({ 
        ...prev, 
        familyComfort: prev.familyComfort ? `${prev.familyComfort} ${transcript}` : transcript 
      }));
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListeningSTT(false);
    };

    recognition.onend = () => {
      setIsListeningSTT(false);
    };

    recognition.start();
  };

  // --- Speech Synthesis (TTS) Logic ---
  const handleToggleSpeech = async () => {
    if (isSpeaking || isPreparingSpeech) {
      stopSpeech();
      return;
    }

    const currentSpeechId = Date.now();
    speechRequestRef.current = currentSpeechId;
    setIsPreparingSpeech(true);

    try {
      const gender = (view === 'REP_RESULT' || view === 'REP_SETTINGS') ? repSettings.voiceGender : funSettings.voiceGender;
      const base64Audio = await generateSpeech(generatedPrayer, gender);
      
      // Check if it was cancelled during generation
      if (speechRequestRef.current !== currentSpeechId) return;

      const audioData = decodeBase64(base64Audio);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = ctx;
      
      const buffer = await decodeAudioData(audioData, ctx, 24000, 1);
      
      // Check again before playback starts
      if (speechRequestRef.current !== currentSpeechId) return;

      setIsPreparingSpeech(false);
      setIsSpeaking(true);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      source.onended = () => {
        if (speechRequestRef.current === currentSpeechId) {
          setIsSpeaking(false);
          audioSourceRef.current = null;
        }
      };

      audioSourceRef.current = source;
      source.start();
    } catch (error) {
      if (speechRequestRef.current === currentSpeechId) {
        alert("음성 생성 중 오류가 발생했습니다.");
        setIsPreparingSpeech(false);
        setIsSpeaking(false);
      }
    }
  };

  const handleDownloadAudio = async () => {
    if (isDownloading) {
      downloadRequestRef.current = 0; // Cancel
      setIsDownloading(false);
      return;
    }

    const currentDownloadId = Date.now();
    downloadRequestRef.current = currentDownloadId;
    setIsDownloading(true);

    try {
      const gender = (view === 'REP_RESULT' || view === 'REP_SETTINGS') ? repSettings.voiceGender : funSettings.voiceGender;
      const base64Audio = await generateSpeech(generatedPrayer, gender);
      
      if (downloadRequestRef.current !== currentDownloadId) return;

      const audioData = decodeBase64(base64Audio);
      const wavBlob = createWavBlob(audioData, 24000);
      const url = URL.createObjectURL(wavBlob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `은혜의_기도문_낭독_${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      if (downloadRequestRef.current === currentDownloadId) {
        alert("음성 파일 다운로드 중 오류가 발생했습니다.");
      }
    } finally {
      if (downloadRequestRef.current === currentDownloadId) {
        setIsDownloading(false);
      }
    }
  };

  const stopSpeech = () => {
    speechRequestRef.current = 0; // Cancel generation phase
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
      audioSourceRef.current = null;
    }
    setIsPreparingSpeech(false);
    setIsSpeaking(false);
  };

  useEffect(() => {
    return () => stopSpeech();
  }, []);

  const handleEnterFullscreen = () => {
    if (fullscreenRef.current) {
        fullscreenRef.current.requestFullscreen().catch(err => {
            alert(`전체화면 전환에 실패했습니다: ${err.message}`);
        });
    }
  };

  const handleExitFullscreen = () => {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    }
  };

  const NavButtonsAtBottom = () => (
    <div className="mt-8 pt-8 border-t border-stone-800/50 space-y-3 no-print">
      <p className={`text-xs font-bold text-center uppercase tracking-widest ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>다른 기도문 작성하기</p>
      <div className="flex flex-col md:flex-row gap-3">
        <button
          onClick={() => changeView('REP_SETTINGS')}
          className={`flex-1 py-4 rounded-xl font-bold transition-all shadow-md ${view === 'REP_RESULT' ? 'bg-amber-600/20 text-amber-500 border border-amber-600/30' : (isDarkMode ? 'bg-stone-900 border border-stone-800 text-stone-300' : 'bg-white border border-stone-200 text-stone-700')}`}
        >
          ⛪ 대표기도 설정으로
        </button>
        <button
          onClick={() => changeView('FUN_SETTINGS')}
          className={`flex-1 py-4 rounded-xl font-bold transition-all shadow-md ${view === 'FUN_RESULT' ? 'bg-amber-600/20 text-amber-500 border border-amber-600/30' : (isDarkMode ? 'bg-stone-900 border border-stone-800 text-stone-300' : 'bg-white border border-stone-200 text-stone-700')}`}
        >
          🌹 장례기도 설정으로
        </button>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col lg:flex-row min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-stone-950 text-stone-200' : 'bg-stone-50 text-stone-800'}`}>
      <Sidebar activeView={view} setView={changeView} isDarkMode={isDarkMode} />
      
      <main className="flex-1 overflow-y-auto relative">
        <div className={`sticky top-0 z-10 p-4 flex justify-end transition-colors duration-300 no-print ${isDarkMode ? 'bg-stone-950/80' : 'bg-stone-50/80'} backdrop-blur-md`}>
          <ThemeToggle isDarkMode={isDarkMode} toggle={() => setIsDarkMode(!isDarkMode)} />
        </div>

        <div className="max-w-4xl mx-auto p-4 md:p-8 lg:p-12 h-[calc(100%-4rem)]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-500 animate-fade-in">
              <div className={`w-16 h-16 border-4 border-t-amber-600 rounded-full animate-spin mb-4 ${isDarkMode ? 'border-stone-800' : 'border-amber-100'}`}></div>
              <p className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>최고의 영성을 담은 기도문을 구성 중입니다</p>
              <p className={`text-sm mb-6 text-center max-w-sm ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                { ((repSettings.attachments?.length || 0) > 0 || (funSettings.attachments?.length || 0) > 0) 
                  ? `${(repSettings.attachments?.length || 0) + (funSettings.attachments?.length || 0)}개의 파일 속 영감과 실시간 데이터를 정밀 분석하고 있습니다...` 
                  : "실시간 검색 데이터를 통한 심층 분석이 진행되고 있습니다..." }
              </p>
              <button onClick={handleCancelLoading} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all border ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-200' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}>생성 취소</button>
            </div>
          ) : (
            <>
              {view === 'REP_SETTINGS' && (
                <div className="animate-fade-in">
                  <div className="mb-8">
                    <h2 className={`text-3xl font-bold serif-font ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>대표기도 설정</h2>
                    <p className={`mt-2 ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>예배 정보와 각 단계별 기도 제목을 설정하세요.</p>
                  </div>
                  
                  <div ref={settingSectionRef} className={`p-6 rounded-2xl border mb-8 relative transition-colors ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-amber-50/50 border-amber-100'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                      
                      {/* 예배 종류가 '기타'일 때도 교회 이름 입력란을 유지 */}
                      <FormField 
                          isDarkMode={isDarkMode}
                          inputRef={churchNameRef}
                          label="교회 이름" 
                          type="input" 
                          placeholder="예: 은혜교회" 
                          value={repSettings.churchName} 
                          onChange={(v) => setRepSettings(prev => ({ ...prev, churchName: v }))} 
                          onClear={() => setRepSettings(prev => ({ ...prev, churchName: '' }))}
                          error={attemptedSubmit && repSettings.serviceType !== '기타' && !repSettings.churchName}
                      />
                      
                      <div className="mb-6">
                        {/* 예배 종류가 '기타'일 때도 설교자 정보 입력란을 유지 */}
                        <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-stone-400' : 'text-stone-700'}`}>설교자 정보</label>
                        <div className="flex gap-2">
                          <div className="flex-1">
                              <input
                              ref={pastorNameRef}
                              type="text"
                              placeholder="성함"
                              value={repSettings.pastorName}
                              onChange={(e) => setRepSettings(prev => ({ ...prev, pastorName: e.target.value }))}
                              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-300'} ${attemptedSubmit && repSettings.serviceType !== '기타' && !repSettings.pastorName ? 'border-red-500' : ''}`}
                              />
                          </div>
                          <select
                              value={repSettings.pastorTitle}
                              onChange={(e) => setRepSettings(prev => ({ ...prev, pastorTitle: e.target.value }))}
                              className={`w-32 px-2 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-300'}`}
                          >
                              {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        
                        <div className={`mt-4 grid grid-cols-1 md:grid-cols-2 gap-4`}>
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-stone-400' : 'text-stone-700'}`}>예배 종류</label>
                            <select
                              value={repSettings.serviceType}
                              onChange={(e) => setRepSettings(prev => ({ ...prev, serviceType: e.target.value }))}
                              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-300'}`}
                            >
                              {SERVICE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                            {repSettings.serviceType === '기타' && (
                              <div className="mt-2 animate-fade-in">
                                <input
                                  type="text"
                                  placeholder="예배 종류 직접 입력"
                                  value={repSettings.otherServiceType}
                                  onChange={(e) => setRepSettings(prev => ({ ...prev, otherServiceType: e.target.value }))}
                                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-300'} ${attemptedSubmit && !repSettings.otherServiceType ? 'border-red-500' : ''}`}
                                />
                              </div>
                            )}
                          </div>
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-stone-400' : 'text-stone-700'}`}>기도 시간</label>
                            <select
                              value={repSettings.prayerDuration}
                              onChange={(e) => setRepSettings(prev => ({ ...prev, prayerDuration: e.target.value }))}
                              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-300'}`}
                            >
                              {PRAYER_DURATIONS.map(dur => <option key={dur} value={dur}>{dur}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-stone-400' : 'text-stone-700'}`}>기도 톤</label>
                                <select
                                value={repSettings.prayerTone}
                                onChange={(e) => setRepSettings(prev => ({ ...prev, prayerTone: e.target.value as any }))}
                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-300'}`}
                                >
                                {PRAYER_TONES.map(tone => <option key={tone} value={tone}>{tone}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-stone-400' : 'text-stone-700'}`}>낭독 목소리</label>
                                <select
                                value={repSettings.voiceGender}
                                onChange={(e) => setRepSettings(prev => ({ ...prev, voiceGender: e.target.value as any }))}
                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-300'}`}
                                >
                                    <option value="female">여성 (차분함)</option>
                                    <option value="male">남성 (중후함)</option>
                                </select>
                            </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-8 no-print">
                    <h3 className={`text-lg font-bold mb-4 serif-font ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>기도 단계별 내용</h3>
                    
                    <AccordionField 
                      index={1} 
                      label="찬양과 감사" 
                      value={repSettings.graceAndSalvation} 
                      isOpen={openAccordionIndex === 1} 
                      onToggle={() => setOpenAccordionIndex(openAccordionIndex === 1 ? null : 1)} 
                      onChange={(v) => setRepSettings(prev => ({ ...prev, graceAndSalvation: v }))} 
                      isDarkMode={isDarkMode} 
                      onSearch={() => handleSearchSegment(1)} 
                      onCancelSearch={() => handleSearchSegment(1)} 
                      isSearching={searchingStates[1]} 
                      isEnabled={repSettings.includeGraceAndSalvation}
                      onToggleEnabled={(e) => { e.stopPropagation(); setRepSettings(prev => ({ ...prev, includeGraceAndSalvation: e.target.checked })); }}
                    />
                    
                    <AccordionField 
                      index={2} 
                      label="참회와 고백" 
                      value={repSettings.confessionAndForgiveness} 
                      isOpen={openAccordionIndex === 2} 
                      onToggle={() => setOpenAccordionIndex(openAccordionIndex === 2 ? null : 2)} 
                      onChange={(v) => setRepSettings(prev => ({ ...prev, confessionAndForgiveness: v }))} 
                      isDarkMode={isDarkMode} 
                      onSearch={() => handleSearchSegment(2)} 
                      onCancelSearch={() => handleCancelSearchSegment(2)} 
                      isSearching={searchingStates[2]} 
                      isEnabled={repSettings.includeConfessionAndForgiveness}
                      onToggleEnabled={(e) => { e.stopPropagation(); setRepSettings(prev => ({ ...prev, includeConfessionAndForgiveness: e.target.checked })); }}
                    />

                    <AccordionField 
                      index={3} 
                      label="나라와 민족" 
                      value={repSettings.nationWellbeing} 
                      isOpen={openAccordionIndex === 3} 
                      onToggle={() => setOpenAccordionIndex(openAccordionIndex === 3 ? null : 3)} 
                      onChange={(v) => setRepSettings(prev => ({ ...prev, nationWellbeing: v }))} 
                      isDarkMode={isDarkMode} 
                      onSearch={() => handleSearchSegment(3)} 
                      onCancelSearch={() => handleCancelSearchSegment(3)} 
                      isSearching={searchingStates[3]} 
                      isEnabled={repSettings.includeNationWellbeing}
                      onToggleEnabled={(e) => { e.stopPropagation(); setRepSettings(prev => ({ ...prev, includeNationWellbeing: e.target.checked })); }}
                    />

                    <AccordionField 
                      index={4} 
                      label="교회와 선교" 
                      value={repSettings.churchNeeds} 
                      isOpen={openAccordionIndex === 4} 
                      onToggle={() => setOpenAccordionIndex(openAccordionIndex === 4 ? null : 4)} 
                      onChange={(v) => setRepSettings(prev => ({ ...prev, churchNeeds: v }))} 
                      isDarkMode={isDarkMode} 
                      onSearch={() => handleSearchSegment(4)} 
                      onCancelSearch={() => handleCancelSearchSegment(4)} 
                      isSearching={searchingStates[4]} 
                      isEnabled={repSettings.includeChurchNeeds}
                      onToggleEnabled={(e) => { e.stopPropagation(); setRepSettings(prev => ({ ...prev, includeChurchNeeds: e.target.checked })); }}
                    />

                    <AccordionField 
                      index={5} 
                      label="치유와 은혜" 
                      value={repSettings.specialGraceAndHealing} 
                      isOpen={openAccordionIndex === 5} 
                      onToggle={() => setOpenAccordionIndex(openAccordionIndex === 5 ? null : 5)} 
                      onChange={(v) => setRepSettings(prev => ({ ...prev, specialGraceAndHealing: v }))} 
                      isDarkMode={isDarkMode} 
                      onSearch={() => handleSearchSegment(5)} 
                      onCancelSearch={() => handleCancelSearchSegment(5)} 
                      isSearching={searchingStates[5]} 
                      isEnabled={repSettings.includeSpecialGraceAndHealing}
                      onToggleEnabled={(e) => { e.stopPropagation(); setRepSettings(prev => ({ ...prev, includeSpecialGraceAndHealing: e.target.checked })); }}
                    />

                    <AccordionField 
                      index={6} 
                      label="설교자/말씀" 
                      value={repSettings.preacherFilling} 
                      isOpen={openAccordionIndex === 6} 
                      onToggle={() => setOpenAccordionIndex(openAccordionIndex === 6 ? null : 6)} 
                      onChange={(v) => setRepSettings(prev => ({ ...prev, preacherFilling: v }))} 
                      isDarkMode={isDarkMode} 
                      onSearch={() => handleSearchSegment(6)} 
                      onCancelSearch={() => handleCancelSearchSegment(6)} 
                      isSearching={searchingStates[6]} 
                      isEnabled={repSettings.includePreacherFilling}
                      onToggleEnabled={(e) => { e.stopPropagation(); setRepSettings(prev => ({ ...prev, includePreacherFilling: e.target.checked })); }}
                    />
                  </div>

                  <div className="no-print">
                    <FormField 
                      isDarkMode={isDarkMode} 
                      label="기타 추가 요청 (선택)" 
                      value={repSettings.additionalRequests} 
                      onChange={(v) => setRepSettings(prev => ({ ...prev, additionalRequests: v }))} 
                      placeholder="예) 성가대 찬양, 예배 봉사자, 교회 학교 부흥 등 추가하고 싶은 내용을 입력하세요." 
                      attachedImages={repSettings.attachments}
                      onAttachment={(data, mimeType, fileName) => setRepSettings(prev => ({ ...prev, attachments: [...(prev.attachments || []), { data, mimeType, fileName }] }))}
                      onImageRemove={(idx) => setRepSettings(prev => ({ ...prev, attachments: prev.attachments?.filter((_, i) => i !== idx) }))}
                      onClear={() => setRepSettings(prev => ({ ...prev, additionalRequests: '' }))}
                      onClearAttachments={() => setRepSettings(prev => ({ ...prev, attachments: [] }))}
                    />
                    <div className="flex gap-4 mt-4">
                      <button onClick={handleResetRep} className={`px-8 font-bold py-4 rounded-xl shadow-md ${isDarkMode ? 'bg-stone-800 text-stone-400' : 'bg-stone-200 text-stone-600'}`}>취소/초기화</button>
                      <button onClick={handleGenerateRep} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-4 rounded-xl shadow-lg">은혜로운 대표기도문 생성하기</button>
                    </div>
                  </div>
                </div>
              )}

              {view === 'FUN_SETTINGS' && (
                <div className="animate-fade-in">
                  <div className="mb-8">
                    <h2 className={`text-3xl font-bold serif-font ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>장례기도 설정</h2>
                    <p className={`mt-2 ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>천국 소망과 위로를 담은 장례 예배 기도문을 설정합니다.</p>
                  </div>
                  <div className={`p-6 rounded-2xl border mb-8 ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-stone-100 border-stone-200'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                      <FormField isDarkMode={isDarkMode} inputRef={deceasedNameRef} label="고인 성함" type="input" value={funSettings.deceasedName} onChange={(v) => setFunSettings(prev => ({ ...prev, deceasedName: v }))} error={attemptedSubmit && !funSettings.deceasedName} onClear={() => setFunSettings(prev => ({ ...prev, deceasedName: '' }))} />
                      <FormField isDarkMode={isDarkMode} label="고인 직분" type="input" value={funSettings.deceasedTitle} onChange={(v) => setFunSettings(prev => ({ ...prev, deceasedTitle: v }))} onClear={() => setFunSettings(prev => ({ ...prev, deceasedTitle: '' }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <div className="mb-6">
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-stone-400' : 'text-stone-700'}`}>예배 구분</label>
                      <select value={funSettings.funeralType} onChange={(e) => setFunSettings(prev => ({ ...prev, funeralType: e.target.value as any }))} className={`w-full px-4 py-3 border rounded-lg ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-300'}`}>
                        <option value="발인">발인 예배</option><option value="입관">입관 예배</option><option value="하관">하관 예배</option><option value="추모">추모 예배</option>
                      </select>
                    </div>
                    <div className="mb-6">
                        <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-stone-400' : 'text-stone-700'}`}>낭독 목소리</label>
                        <select
                        value={funSettings.voiceGender}
                        onChange={(e) => setFunSettings(prev => ({ ...prev, voiceGender: e.target.value as any }))}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-200' : 'bg-white border-stone-300'}`}
                        >
                            <option value="female">여성 (차분함)</option>
                            <option value="male">남성 (중후함)</option>
                        </select>
                    </div>
                  </div>
                  <FormField 
                    isDarkMode={isDarkMode} 
                    label="유족 위로" 
                    value={funSettings.familyComfort} 
                    onChange={(v) => setFunSettings(prev => ({ ...prev, familyComfort: v }))} 
                    onClear={() => setFunSettings(prev => ({ ...prev, familyComfort: '' }))}
                    onSpeech={handleStartSTT}
                    isListening={isListeningSTT}
                  />
                  <FormField 
                    isDarkMode={isDarkMode} 
                    label="기타 추가 요청 (선택)" 
                    value={funSettings.additionalRequests} 
                    onChange={(v) => setFunSettings(prev => ({ ...prev, additionalRequests: v }))} 
                    placeholder="예: 고인의 평소 성품, 특정 유가족의 상황 등 강조하고 싶은 내용을 입력하세요." 
                    attachedImages={funSettings.attachments}
                    onAttachment={(data, mimeType, fileName) => setFunSettings(prev => ({ ...prev, attachments: [...(prev.attachments || []), { data, mimeType, fileName }] }))}
                    onImageRemove={(idx) => setFunSettings(prev => ({ ...prev, attachments: prev.attachments?.filter((_, i) => i !== idx) }))}
                    onClear={() => setFunSettings(prev => ({ ...prev, additionalRequests: '' }))}
                    onClearAttachments={() => setFunSettings(prev => ({ ...prev, attachments: [] }))}
                  />
                  <div className="flex gap-4 mt-4">
                    <button onClick={handleResetFun} className={`px-8 font-bold py-4 rounded-xl shadow-md ${isDarkMode ? 'bg-stone-800 text-stone-400' : 'bg-stone-200 text-stone-600'}`}>취소/초기화</button>
                    <button onClick={handleGenerateFun} className="flex-1 bg-stone-700 hover:bg-stone-800 text-white font-bold py-4 rounded-xl shadow-lg">위로와 소망의 장례기도문 생성하기</button>
                  </div>
                </div>
              )}

              {(view === 'REP_RESULT' || view === 'FUN_RESULT') && (
                <div className="animate-fade-in flex flex-col h-full">
                  <div className="flex justify-between items-center mb-6 no-print">
                    <h2 className={`text-3xl font-bold serif-font ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>기도문 생성 완료</h2>
                    <button onClick={() => changeView(view === 'REP_RESULT' ? 'REP_SETTINGS' : 'FUN_SETTINGS')} className={`font-medium hover:underline ${isDarkMode ? 'text-amber-500' : 'text-amber-700'}`}>← 설정으로 돌아가기</button>
                  </div>
                  <div id="prayer-fullscreen-container" ref={fullscreenRef} className={`print-area border rounded-2xl shadow-sm p-8 flex-1 overflow-y-auto mb-6 transition-colors relative ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}>
                    
                    {/* Audio Controls Container */}
                    <div className="absolute top-4 right-4 z-10 flex gap-2 no-print">
                      
                      {/* Voice Switcher (Small) */}
                      <button 
                        onClick={() => {
                            if (view === 'REP_RESULT') {
                                setRepSettings(prev => ({ ...prev, voiceGender: prev.voiceGender === 'female' ? 'male' : 'female' }));
                            } else {
                                setFunSettings(prev => ({ ...prev, voiceGender: prev.voiceGender === 'female' ? 'male' : 'female' }));
                            }
                            stopSpeech(); // Stop if playing when changing voice
                        }}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-400' : 'bg-white border-stone-200 text-stone-500 shadow-sm'}`}
                        title="목소리 성별 변경"
                      >
                        {(view === 'REP_RESULT' ? repSettings.voiceGender : funSettings.voiceGender) === 'female' ? '👩 여성' : '👨 남성'}
                      </button>

                      {/* Audio Download Button */}
                      <button 
                        onClick={handleDownloadAudio} 
                        className={`p-3 rounded-full shadow-lg transition-all border ${isDownloading ? 'bg-red-500/10 border-red-500/30 text-red-500' : (isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50')}`}
                        title={isDownloading ? "다운로드 중단" : "음성 다운로드 (.wav)"}
                      >
                        {isDownloading ? (
                          <div className="relative w-6 h-6 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-t-transparent border-red-500 rounded-full animate-spin absolute"></div>
                            <span className="text-[10px] font-bold">✕</span>
                          </div>
                        ) : (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        )}
                      </button>

                      {/* Audio Toggle Button */}
                      <button 
                        onClick={handleToggleSpeech} 
                        className={`p-3 rounded-full shadow-lg transition-all border ${isSpeaking ? 'bg-amber-500 border-amber-400 text-white animate-pulse' : isPreparingSpeech ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : (isDarkMode ? 'bg-stone-800 border-stone-700 text-amber-500 hover:bg-stone-700' : 'bg-white border-stone-200 text-amber-600 hover:bg-amber-50')}`}
                        title={isSpeaking ? "낭독 중지" : isPreparingSpeech ? "준비 중단" : "기도문 낭독"}
                      >
                        {isSpeaking ? (
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        ) : isPreparingSpeech ? (
                          <div className="relative w-6 h-6 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-t-transparent border-amber-500 rounded-full animate-spin absolute"></div>
                            <span className="text-[10px] font-bold">✕</span>
                          </div>
                        ) : (
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" /></svg>
                        )}
                      </button>
                    </div>

                    <button onClick={handleExitFullscreen} className="exit-btn hidden fixed top-8 right-8 z-50 bg-stone-800/50 hover:bg-stone-700 text-stone-300 px-4 py-2 rounded-full border border-stone-700 no-print">전체화면 종료 (ESC)</button>
                    <div className={`fullscreen-content prayer-text prose max-w-none whitespace-pre-wrap leading-relaxed text-lg serif-font ${isDarkMode ? 'text-stone-300 prose-invert' : 'text-stone-800'}`}>
                      {generatedPrayer}
                    </div>
                  </div>
                  {sources.length > 0 && (
                    <div className={`sources-area mb-6 p-4 rounded-xl border no-print ${isDarkMode ? 'bg-stone-900 border-stone-800 text-stone-300' : 'bg-stone-100 border-stone-200 text-stone-600'}`}>
                      <h3 className="text-sm font-bold uppercase tracking-wider mb-2">분석 참고 문헌</h3>
                      <div className="flex flex-wrap gap-2">{sources.map((src, idx) => (<a key={idx} href={src.uri} target="_blank" rel="noopener noreferrer" className={`text-xs px-3 py-1.5 rounded-full border ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-400' : 'bg-white border-stone-300 text-stone-500'}`}>{src.title || '출처'}</a>))}</div>
                    </div>
                  )}
                  <div className="space-y-4 no-print">
                    <div className="flex gap-4">
                      <button onClick={() => { navigator.clipboard.writeText(generatedPrayer); alert("기도문이 복사되었습니다."); }} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-4 rounded-xl shadow-lg">기도문 복사하기</button>
                      <button onClick={handleEnterFullscreen} className={`px-8 font-bold py-4 rounded-xl shadow-md flex items-center gap-2 ${isDarkMode ? 'bg-stone-800 text-stone-200' : 'bg-stone-200 text-stone-800'}`}><span>⛶</span> 전체화면</button>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4">
                       <div className="flex-1 flex items-center px-4 py-3 border rounded-xl bg-amber-600 bg-opacity-10 border-amber-500/30">
                          <span className={`text-sm font-bold ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>✨ 선택하신 {view === 'REP_RESULT' ? repSettings.prayerTone : '격조 높은'} 톤과 {(view === 'REP_RESULT' ? repSettings.voiceGender : funSettings.voiceGender) === 'female' ? '여성' : '남성'} 목소리로 작성되었습니다</span>
                       </div>
                       <button onClick={handleRegenerate} className={`flex-1 border font-bold py-3 rounded-xl ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-300' : 'bg-stone-100 border-stone-300 text-stone-700'}`}>최고의 품질로 다시 작성</button>
                    </div>
                    
                    <NavButtonsAtBottom />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
