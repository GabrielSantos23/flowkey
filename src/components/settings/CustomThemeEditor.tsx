import React from "react";
import { ThemeHolder } from "../../types";
import { useTheme } from "../../context/ThemeContext";

export const CustomThemeEditor: React.FC = () => {
  const { customTheme, setCustomTheme } = useTheme();

  const handleChange = (key: keyof ThemeHolder, value: string) => {
    setCustomTheme({
      ...customTheme,
      [key]: value,
    });
  };

  const fields: { key: keyof ThemeHolder; label: string }[] = [
    { key: "IslandColor", label: "Island Background" },
    { key: "Primary", label: "Primary Accent" },
    { key: "Secondary", label: "Secondary / Shadow" },
    { key: "TextMain", label: "Main Text" },
    { key: "TextSecond", label: "Secondary Text" },
    { key: "TextThird", label: "Muted Text" },
    { key: "Success", label: "Success" },
    { key: "Error", label: "Error / Warning" },
    { key: "IconColor", label: "Icon Color" },
    { key: "WidgetBackground", label: "Widget Card Background" },
  ];

  return (
    <div className="space-y-3 p-3 bg-card rounded-xl border border-border">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground">Custom Theme Palette</h4>
        <span className="text-[10px] text-muted-foreground">Live JSON Theme</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
        {fields.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-muted/40 border border-border">
            <span className="text-[11px] text-foreground truncate">{label}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <input
                type="color"
                value={customTheme[key].startsWith("#") ? customTheme[key].slice(0, 7) : "#ffffff"}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
              />
              <input
                type="text"
                value={customTheme[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-16 px-1 py-0.5 rounded text-[10px] font-mono bg-background text-foreground border border-input text-center focus:outline-none"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
