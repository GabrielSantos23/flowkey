import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WeatherData } from "../../../types";
import { useSettings } from "../../../context/SettingsContext";
import { Cloud, Sun, CloudRain, CloudLightning, CloudSnow, CloudFog, Wind, MapPin } from "lucide-react";

export const WeatherWidget: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [weather, setWeather] = useState<WeatherData>({
    city: "Local",
    region: "",
    weather_text: "Clear Sky",
    weather_code: 0,
    temperature_celsius: "21.0°C",
    temperature_fahrenheit: "69.8°F",
    temp_c: 21.0,
    temp_f: 69.8,
    icon: "sunny",
  });

  const [loading, setLoading] = useState(true);

  const fetchWeather = async () => {
    try {
      const data = await invoke<WeatherData>("get_weather_data", {
        useCelsius: settings.use_celsius,
      });
      if (data) setWeather(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 120000); // 2 min
    return () => clearInterval(interval);
  }, [settings.use_celsius]);

  const getWeatherIcon = (icon: string) => {
    const cls = "w-10 h-10 text-island-primary drop-shadow-md";
    switch (icon) {
      case "sunny":
        return <Sun className={`${cls} text-amber-400`} />;
      case "cloudy":
        return <Cloud className={`${cls} text-slate-300`} />;
      case "rainy":
        return <CloudRain className={`${cls} text-sky-400`} />;
      case "thunderstorm":
        return <CloudLightning className={`${cls} text-violet-400`} />;
      case "snowy":
        return <CloudSnow className={`${cls} text-blue-200`} />;
      case "foggy":
        return <CloudFog className={`${cls} text-slate-400`} />;
      case "windy":
        return <Wind className={`${cls} text-teal-300`} />;
      default:
        return <Sun className={`${cls} text-amber-400`} />;
    }
  };

  const toggleUnits = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateSettings({ use_celsius: !settings.use_celsius });
  };

  const toggleHideLocation = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateSettings({ hide_location: !settings.hide_location });
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-island-widget backdrop-blur-md p-4 flex flex-col justify-between border border-white/5 shadow-inner transition-all hover:border-white/10 group min-w-[200px] flex-1 select-none">
      {/* Top row: City & Condition */}
      <div className="flex items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-1.5 min-w-0" onClick={toggleHideLocation} title="Click to toggle location visibility">
          <MapPin className="w-3.5 h-3.5 text-island-primary flex-shrink-0 cursor-pointer" />
          <span className="text-xs font-semibold text-island-textMain truncate">
            {settings.hide_location ? "••••••" : weather.city}
          </span>
        </div>

        <span className="text-[11px] font-medium text-island-textSecond capitalize truncate">
          {loading ? "Updating..." : weather.weather_text}
        </span>
      </div>

      {/* Main Temperature & Big Icon */}
      <div className="flex items-end justify-between mt-2 z-10">
        <div className="cursor-pointer group/temp" onClick={toggleUnits} title="Click to toggle °C / °F">
          <span className="text-3xl font-extrabold text-island-textMain tracking-tight">
            {settings.use_celsius ? Math.round(weather.temp_c) : Math.round(weather.temp_f)}
          </span>
          <span className="text-sm font-semibold text-island-primary ml-1 group-hover/temp:underline">
            {settings.use_celsius ? "°C" : "°F"}
          </span>
        </div>

        <div className="flex items-center justify-center pl-2">
          {getWeatherIcon(weather.icon)}
        </div>
      </div>
    </div>
  );
};
