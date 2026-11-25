use keyring::Entry;
use reqwest::{Client, Method};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

const BACKEND_URL: &str = "https://spetly.app";
const KEYCHAIN_SERVICE: &str = "app.spetly.ads-manager";
const KEYCHAIN_ACCOUNT: &str = "super-admin-session";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoginRequest {
    email: String,
    password: String,
    two_factor_code: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoginResponse {
    ok: bool,
    token: Option<String>,
    expires_at: Option<String>,
    user: Option<Value>,
    code: Option<String>,
    message: Option<String>,
}

fn keychain_entry() -> Result<Entry, String> {
    Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT).map_err(|error| format!("Keychain hiba: {error}"))
}

fn load_token() -> Result<String, String> {
    keychain_entry()?
        .get_password()
        .map_err(|_| "Nincs aktív bejelentkezés.".to_string())
}

fn client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(310))
        .user_agent("SPETLY-Ads-Manager/1.0.0 (macOS; Apple-Silicon)")
        .build()
        .map_err(|error| format!("HTTP kliens hiba: {error}"))
}

fn validate_api_path(path: &str) -> Result<(), String> {
    if !path.starts_with("/api/meta-ads/") || path.contains("//") || path.contains('\n') || path.contains('\r') {
        return Err("Nem engedélyezett API útvonal.".to_string());
    }
    Ok(())
}

async fn request(method: Method, path: String, body: Option<Value>) -> Result<Value, String> {
    validate_api_path(&path)?;
    let token = load_token()?;
    let mut builder = client()?
        .request(method, format!("{BACKEND_URL}{path}"))
        .bearer_auth(token)
        .header("Accept", "application/json");
    if let Some(payload) = body {
        builder = builder.json(&payload);
    }
    let response = builder.send().await.map_err(|error| format!("Kapcsolódási hiba: {error}"))?;
    let status = response.status();
    let payload = response.json::<Value>().await.map_err(|error| format!("Hibás szerverválasz: {error}"))?;
    if status.as_u16() == 401 {
        let _ = keychain_entry()?.delete_credential();
        return Err("A munkamenet lejárt. Jelentkezz be újra.".to_string());
    }
    if !status.is_success() {
        let message = payload.get("message").and_then(Value::as_str).unwrap_or("A backend kérés sikertelen.");
        return Err(message.to_string());
    }
    Ok(payload)
}

#[tauri::command]
async fn login(email: String, password: String, two_factor_code: Option<String>) -> Result<Value, String> {
    let response = client()?
        .post(format!("{BACKEND_URL}/api/desktop/auth/login"))
        .json(&LoginRequest { email, password, two_factor_code })
        .send()
        .await
        .map_err(|error| format!("Kapcsolódási hiba: {error}"))?;
    let status = response.status();
    let payload = response.json::<LoginResponse>().await.map_err(|error| format!("Hibás szerverválasz: {error}"))?;
    if !status.is_success() || !payload.ok {
        return Ok(json!({
            "ok": false,
            "code": payload.code.unwrap_or_else(|| "login_failed".to_string()),
            "message": payload.message.unwrap_or_else(|| "A belépés sikertelen.".to_string())
        }));
    }
    let token = payload.token.ok_or_else(|| "A szerver nem adott munkamenetet.".to_string())?;
    keychain_entry()?.set_password(&token).map_err(|error| format!("A Keychain mentés sikertelen: {error}"))?;
    Ok(json!({ "ok": true, "expiresAt": payload.expires_at, "user": payload.user }))
}

#[tauri::command]
fn logout() -> Result<(), String> {
    match keychain_entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("A kijelentkezés sikertelen: {error}"))
    }
}

#[tauri::command]
fn has_session() -> bool {
    load_token().is_ok()
}

#[tauri::command]
async fn api_get(path: String) -> Result<Value, String> {
    request(Method::GET, path, None).await
}

#[tauri::command]
async fn api_post(path: String, body: Value) -> Result<Value, String> {
    request(Method::POST, path, Some(body)).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![login, logout, has_session, api_get, api_post])
        .run(tauri::generate_context!())
        .expect("SPETLY Ads Manager failed to start");
}
