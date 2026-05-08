use std::fs;
use tauri::Manager;

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_opened_file() -> Option<String> {
    let mut args = std::env::args();
    args.next();
    args.next()
}

#[derive(serde::Serialize)]
struct FileNode {
    name: String,
    path: String,
    is_dir: bool,
}

#[tauri::command]
fn read_dir(path: String) -> Result<Vec<FileNode>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut nodes: Vec<FileNode> = entries
        .filter_map(|e| e.ok())
        .filter(|e| !e.file_name().to_string_lossy().starts_with('.'))
        .map(|e| {
            let is_dir = e.metadata().map(|m| m.is_dir()).unwrap_or(false);
            FileNode {
                name: e.file_name().to_string_lossy().to_string(),
                path: e.path().to_string_lossy().to_string(),
                is_dir,
            }
        })
        .collect();
    nodes.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(nodes)
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
struct Session {
    file_path: Option<String>,
    dir_path: Option<String>,
}

fn session_file(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path()
        .app_config_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("session.json")
}

#[tauri::command]
fn load_session(app: tauri::AppHandle) -> Session {
    let path = session_file(&app);
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn save_session(app: tauri::AppHandle, session: Session) -> Result<(), String> {
    let path = session_file(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string(&session).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Embed the PNG icon bytes at compile time
            let icon_bytes = include_bytes!("../icons/icon.png");

            // Set the icon via Tauri's API (works for title bar on all platforms)
            if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
                let _ = app
                    .get_webview_window("main")
                    .and_then(|w| w.set_icon(icon).ok());
            }

            #[cfg(target_os = "linux")]
            {
                // On Linux, set the GTK window icon using GIO memory stream
                // This is what the task bar / window switcher actually reads
                use gtk::prelude::*;
                let window = app.get_webview_window("main").expect("main window not found");
                let gtk_window = window.gtk_window().expect("failed to get gtk window");
                let stream =
                    gtk::gio::MemoryInputStream::from_bytes(&gtk::glib::Bytes::from(icon_bytes));
                let pixbuf = gtk::gdk_pixbuf::Pixbuf::from_stream(
                    &stream,
                    gtk::gio::Cancellable::NONE,
                )
                .expect("failed to load icon pixbuf from stream");
                gtk_window.set_icon(Some(&pixbuf));
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file, write_file, get_opened_file, read_dir,
            load_session, save_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
