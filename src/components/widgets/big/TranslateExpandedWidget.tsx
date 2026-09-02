import React, { useState, useEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ArrowLeftRight,
  Volume2,
  Copy,
  Check,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { DeepLTranslateResponse, TranslationUsage, LanguageOption, ViewMode } from "@/types";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectSeparator,
} from "@/components/ui/select";

interface TranslateExpandedWidgetProps {
  onMinimize?: () => void;
  onViewChange?: (view: ViewMode) => void;
}

const DEFAULT_LANGUAGES: LanguageOption[] = [
  { code: "PT-BR", name: "Portuguese", native_name: "Português" },
  { code: "EN-US", name: "English", native_name: "English" },
  { code: "ES", name: "Spanish", native_name: "Español" },
  { code: "DE", name: "German", native_name: "Deutsch" },
  { code: "FR", name: "French", native_name: "Français" },
  { code: "IT", name: "Italian", native_name: "Italiano" },
  { code: "JA", name: "Japanese", native_name: "日本語" },
  { code: "ZH-HANS", name: "Chinese", native_name: "简体中文" },
  { code: "RU", name: "Russian", native_name: "Русский" },
  { code: "NL", name: "Dutch", native_name: "Nederlands" },
  { code: "PL", name: "Polish", native_name: "Polski" },
  { code: "KO", name: "Korean", native_name: "한국어" },
  { code: "SV", name: "Swedish", native_name: "Svenska" },
  { code: "TR", name: "Turkish", native_name: "Türkçe" },
  { code: "AR", name: "Arabic", native_name: "العربية" },
];

export const TranslateExpandedWidget: React.FC<TranslateExpandedWidgetProps> = () => {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [sourceLang, setSourceLang] = useState<string>(() => localStorage.getItem("deepl_src_lang") || "PT-BR");
  const [targetLang, setTargetLang] = useState<string>(() => localStorage.getItem("deepl_tgt_lang") || "EN-US");
  const [detectedLang, setDetectedLang] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const [usage, setUsage] = useState<TranslationUsage | null>(null);
  const [languages, setLanguages] = useState<LanguageOption[]>(DEFAULT_LANGUAGES);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    invoke<LanguageOption[]>("get_supported_languages")
      .then((langs) => {
        if (langs && langs.length > 0) setLanguages(langs);
      })
      .catch(() => {});

    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const u = await invoke<TranslationUsage>("get_translation_usage");
      setUsage(u);
    } catch {}
  };

  const handleSourceLangChange = (code: string) => {
    setSourceLang(code);
    localStorage.setItem("deepl_src_lang", code);
    if (inputText.trim()) {
      executeTranslation(inputText, code, targetLang);
    }
  };

  const handleTargetLangChange = (code: string) => {
    setTargetLang(code);
    localStorage.setItem("deepl_tgt_lang", code);
    if (inputText.trim()) {
      executeTranslation(inputText, sourceLang, code);
    }
  };

  const handleSwapLanguages = () => {
    if (sourceLang === "AUTO") {
      if (detectedLang) {
        const newSrc = targetLang;
        const newTgt = detectedLang;
        setSourceLang(newSrc);
        setTargetLang(newTgt);
        localStorage.setItem("deepl_src_lang", newSrc);
        localStorage.setItem("deepl_tgt_lang", newTgt);
        if (outputText) {
          setInputText(outputText);
          setOutputText(inputText);
          executeTranslation(outputText, newSrc, newTgt);
        }
      }
      return;
    }

    const tempSrc = sourceLang;
    const tempTgt = targetLang;
    setSourceLang(tempTgt);
    setTargetLang(tempSrc);
    localStorage.setItem("deepl_src_lang", tempTgt);
    localStorage.setItem("deepl_tgt_lang", tempSrc);

    if (outputText) {
      setInputText(outputText);
      setOutputText(inputText);
      executeTranslation(outputText, tempTgt, tempSrc);
    }
  };

  const executeTranslation = async (text: string, src: string, tgt: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setOutputText("");
      setDetectedLang(null);
      setErrorMsg(null);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await invoke<DeepLTranslateResponse>("translate_text", {
        text: trimmed,
        sourceLang: src === "AUTO" ? null : src,
        targetLang: tgt,
      });

      if (res && res.translations && res.translations.length > 0) {
        const primary = res.translations[0];
        setOutputText(primary.text);
        if (primary.detected_source_language) {
          setDetectedLang(primary.detected_source_language);
        }
      }
      fetchUsage();
    } catch (err: any) {
      setErrorMsg(typeof err === "string" ? err : err?.message || "Failed to translate");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (val: string) => {
    setInputText(val);
    if (!val.trim()) {
      setOutputText("");
      setDetectedLang(null);
      setErrorMsg(null);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      executeTranslation(val, sourceLang, targetLang);
    }, 600);
  };

  const handleCopyOutput = async () => {
    if (!outputText) return;
    try {
      await invoke("set_clipboard_text", { text: outputText });
      setIsCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setIsCopied(false), 2000);
    } catch {
      navigator.clipboard.writeText(outputText);
      setIsCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const speakText = (text: string, langCode: string) => {
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode.replace("_", "-");
    window.speechSynthesis.speak(utterance);
  };

  const sourceLangLabel = useMemo(() => {
    if (sourceLang === "AUTO") {
      return detectedLang ? `Auto (${detectedLang})` : "Auto";
    }
    const found = languages.find((l) => l.code === sourceLang);
    return found ? found.name : sourceLang;
  }, [sourceLang, detectedLang, languages]);

  const targetLangLabel = useMemo(() => {
    const found = languages.find((l) => l.code === targetLang);
    return found ? found.name : targetLang;
  }, [targetLang, languages]);

  return (
    <div className="w-[580px] h-[250px] flex flex-col bg-[#141416]/95 backdrop-blur-3xl text-neutral-200 select-none overflow-hidden rounded-[24px] border border-white/5 shadow-2xl relative">
      {/* Error alert toast if any */}
      {errorMsg && (
        <div className="absolute top-2 inset-x-2 z-40 flex items-center justify-between px-3 py-1.5 rounded-xl bg-red-500/90 backdrop-blur-md text-xs text-white shadow-lg">
          <div className="flex items-center gap-2 truncate">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-0.5 hover:bg-white/20 rounded">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Floating Center Swap Button */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-auto">
        <button
          onClick={handleSwapLanguages}
          className="w-8 h-8 rounded-full bg-[#1c1c1f] hover:bg-neutral-800 active:scale-90 border border-white/10 flex items-center justify-center text-neutral-300 hover:text-white shadow-xl transition-all"
          title="Swap Languages"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Split Layout: 50% Left, 50% Right */}
      <div className="flex-1 grid grid-cols-2 h-full w-full">
        {/* LEFT PANEL (Input) */}
        <div className="flex flex-col justify-between bg-black/20 p-3.5 pr-5 border-r border-white/5 relative h-full">
          {/* Top Row: Source Language Dropdown */}
          <div className="flex items-center gap-2 z-20" data-select-container="true">
            <Select
              value={sourceLang}
              onValueChange={(val) => {
                if (val) handleSourceLangChange(val);
              }}
            >
              <SelectTrigger className="h-7 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 text-xs font-semibold text-neutral-200 hover:text-white min-w-[130px] transition-all shadow-sm outline-none">
                <SelectValue placeholder="Source Language">
                  {sourceLangLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 text-white rounded-xl shadow-2xl max-h-56 overflow-y-auto custom-scrollbar p-1 z-50 min-w-[160px]">
                <SelectItem
                  value="AUTO"
                  className="text-xs text-neutral-300 hover:bg-white/10 hover:text-white focus:bg-white focus:text-black focus:font-semibold rounded-lg px-2 py-1.5 cursor-pointer"
                >
                  Auto Detect
                </SelectItem>
                <SelectSeparator className="my-1 bg-white/10" />
                {languages.map((l) => (
                  <SelectItem
                    key={l.code}
                    value={l.code}
                    className="text-xs text-neutral-300 hover:bg-white/10 hover:text-white focus:bg-white focus:text-black focus:font-semibold rounded-lg px-2 py-1.5 cursor-pointer"
                  >
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Textarea Input */}
          <div className="flex-1 my-2 overflow-hidden">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Enter text..."
              className="w-full h-full bg-transparent text-sm text-neutral-100 placeholder-neutral-500 resize-none outline-none leading-relaxed custom-scrollbar"
              autoFocus
            />
          </div>

          {/* Bottom Row: Speaker icon + Clear button */}
          <div className="flex items-center justify-between text-neutral-400">
            <button
              onClick={() => speakText(inputText, sourceLang)}
              disabled={!inputText.trim()}
              className="p-1 rounded-lg hover:bg-white/10 active:scale-90 disabled:opacity-30 disabled:pointer-events-none text-neutral-400 hover:text-white transition-all"
              title="Listen (Text-to-Speech)"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            {inputText && (
              <button
                onClick={() => {
                  setInputText("");
                  setOutputText("");
                  setDetectedLang(null);
                  setErrorMsg(null);
                }}
                className="p-1 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-neutral-300 transition-colors"
                title="Clear text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* RIGHT PANEL (Translation Output) */}
        <div className="flex flex-col justify-between bg-black/10 p-3.5 pl-5 relative h-full">
          {/* Top Row: Target Language Dropdown + Usage */}
          <div className="flex items-center justify-between z-20">
            <div data-select-container="true">
              <Select
                value={targetLang}
                onValueChange={(val) => {
                  if (val) handleTargetLangChange(val);
                }}
              >
                <SelectTrigger className="h-7 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 text-xs font-semibold text-neutral-200 hover:text-white min-w-[130px] transition-all shadow-sm outline-none">
                  <SelectValue placeholder="Target Language">
                    {targetLangLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 text-white rounded-xl shadow-2xl max-h-56 overflow-y-auto custom-scrollbar p-1 z-50 min-w-[160px]">
                  {languages.map((l) => (
                    <SelectItem
                      key={l.code}
                      value={l.code}
                      className="text-xs text-neutral-300 hover:bg-white/10 hover:text-white focus:bg-white focus:text-black focus:font-semibold rounded-lg px-2 py-1.5 cursor-pointer"
                    >
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Usage Status Dot */}
            {usage && (
              <div
                className="flex items-center gap-1.5 text-xs font-medium text-neutral-500"
                title={`${usage.character_count.toLocaleString()} / ${usage.character_limit.toLocaleString()} chars used this month`}
              >
                <span className={`w-2 h-2 rounded-full ${usage.is_limit_reached ? "bg-red-500" : "bg-[#00E640]"}`} />
                <span>{(usage.character_count / 1000).toFixed(1)}k/50k</span>
              </div>
            )}
          </div>

          {/* Translated Text Output Area */}
          <div
            onWheel={(e) => e.stopPropagation()}
            data-scrollable="true"
            className="flex-1 my-2 overflow-y-auto custom-scrollbar text-sm leading-relaxed select-text"
          >
            {isLoading ? (
              <div className="flex items-center gap-2 text-neutral-500 pt-1">
                <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                <span className="text-sm">Translating...</span>
              </div>
            ) : outputText ? (
              <p className="text-neutral-100 select-text whitespace-pre-wrap">{outputText}</p>
            ) : (
              <span className="text-neutral-500 text-sm select-none">Translation</span>
            )}
          </div>

          {/* Bottom Row: Speaker icon + Copy button */}
          <div className="flex items-center justify-between text-neutral-400">
            <button
              onClick={() => speakText(outputText, targetLang)}
              disabled={!outputText}
              className="p-1 rounded-lg hover:bg-white/10 active:scale-90 disabled:opacity-30 disabled:pointer-events-none text-neutral-400 hover:text-white transition-all"
              title="Listen (Text-to-Speech)"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            <button
              onClick={handleCopyOutput}
              disabled={!outputText}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-neutral-400 hover:text-white transition-all text-xs"
              title="Copy translation"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#00E640]" />
                  <span className="text-[#00E640] font-semibold text-xs">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-xs">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranslateExpandedWidget;
