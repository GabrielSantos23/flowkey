use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WeatherData {
    pub city: String,
    pub region: String,
    pub weather_text: String,
    pub weather_code: i32,
    pub temperature_celsius: String,
    pub temperature_fahrenheit: String,
    pub temp_c: f32,
    pub temp_f: f32,
    pub icon: String,
}

#[derive(Deserialize)]
struct IpInfoResponse {
    city: Option<String>,
    region: Option<String>,
    loc: Option<String>,
}

#[derive(Deserialize)]
struct OpenMeteoResponse {
    current: Option<OpenMeteoCurrent>,
}

#[derive(Deserialize)]
struct OpenMeteoCurrent {
    temperature_2m: Option<f32>,
    weather_code: Option<i32>,
}

fn code_to_weather(code: i32) -> (&'static str, &'static str) {
    match code {
        0 => ("Clear Sky", "sunny"),
        1 | 2 => ("Partly Cloudy", "cloudy"),
        3 => ("Overcast", "cloudy"),
        45 | 48 => ("Foggy", "foggy"),
        51..=55 => ("Drizzle", "rainy"),
        61..=65 => ("Rain", "rainy"),
        71..=77 => ("Snow", "snowy"),
        80..=82 => ("Showers", "rainy"),
        85 | 86 => ("Snow Showers", "snowy"),
        95..=99 => ("Thunderstorm", "thunderstorm"),
        _ => ("Clear", "sunny"),
    }
}

#[tauri::command]
pub async fn get_weather_data(_use_celsius: bool) -> Result<WeatherData, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let ip_res = client
        .get("https://ipinfo.io/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let ip_data: IpInfoResponse = ip_res.json().await.map_err(|e| e.to_string())?;
    let city = ip_data.city.unwrap_or_else(|| "Local".to_string());
    let region = ip_data.region.unwrap_or_else(|| "".to_string());

    let (lat, lon) = if let Some(loc) = ip_data.loc {
        let parts: Vec<&str> = loc.split(',').collect();
        if parts.len() == 2 {
            (
                parts[0].parse::<f64>().unwrap_or(0.0),
                parts[1].parse::<f64>().unwrap_or(0.0),
            )
        } else {
            (0.0, 0.0)
        }
    } else {
        (0.0, 0.0)
    };

    let url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&current=temperature_2m,weather_code",
        lat, lon
    );

    let meteo_res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let meteo_data: OpenMeteoResponse = meteo_res.json().await.map_err(|e| e.to_string())?;

    let current = meteo_data.current.unwrap_or(OpenMeteoCurrent {
        temperature_2m: Some(21.0),
        weather_code: Some(0),
    });

    let temp_c = current.temperature_2m.unwrap_or(21.0);
    let temp_f = (temp_c * 9.0 / 5.0) + 32.0;
    let code = current.weather_code.unwrap_or(0);
    let (desc, icon) = code_to_weather(code);

    let temp_c_str = format!("{:.1}°C", temp_c);
    let temp_f_str = format!("{:.1}°F", temp_f);

    Ok(WeatherData {
        city,
        region,
        weather_text: desc.to_string(),
        weather_code: code,
        temperature_celsius: temp_c_str,
        temperature_fahrenheit: temp_f_str,
        temp_c,
        temp_f,
        icon: icon.to_string(),
    })
}
