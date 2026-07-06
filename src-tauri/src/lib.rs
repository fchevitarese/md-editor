use std::collections::HashMap;
use std::fs;
use tauri::{Emitter, Manager};

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
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
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(nodes)
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
struct Session {
    file_path: Option<String>,
    dir_path: Option<String>,
    scroll_positions: HashMap<String, f64>,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct Preferences {
    #[serde(default = "default_font_size")]
    font_size: u32,
    #[serde(default = "default_true")]
    show_minimap: bool,
}

fn default_font_size() -> u32 { 16 }
fn default_true() -> bool { true }

impl Default for Preferences {
    fn default() -> Self {
        Self { font_size: default_font_size(), show_minimap: default_true() }
    }
}

fn data_dir(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path()
        .app_config_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
}

fn session_file(app: &tauri::AppHandle) -> std::path::PathBuf {
    data_dir(app).join("session.json")
}

fn prefs_file(app: &tauri::AppHandle) -> std::path::PathBuf {
    data_dir(app).join("preferences.json")
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

#[tauri::command]
fn save_scroll_position(app: tauri::AppHandle, file_path: String, scroll_top: f64) -> Result<(), String> {
    let path = session_file(&app);
    let mut session: Session = fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    session.scroll_positions.insert(file_path, scroll_top);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string(&session).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_preferences(app: tauri::AppHandle) -> Preferences {
    let path = prefs_file(&app);
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn save_preferences(app: tauri::AppHandle, prefs: Preferences) -> Result<(), String> {
    let path = prefs_file(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string(&prefs).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // When a second instance is launched (e.g. double-click .md file
            // while app is already open), emit the file path to the frontend.
            if let Some(path) = args.iter().nth(1) {
                let _ = app.emit("file-open", path);
            }
        }))
        .setup(|app| {
            let icon_bytes = include_bytes!("../icons/icon.png");

            if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
                let _ = app
                    .get_webview_window("main")
                    .and_then(|w| w.set_icon(icon).ok());
            }

            // On first launch, check CLI arg for file path
            if let Some(path) = std::env::args().nth(1) {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    let _ = handle.emit("file-open", &path);
                });
            }

            #[cfg(target_os = "linux")]
            {
                use gtk::prelude::*;
                match gtk::gdk_pixbuf::Pixbuf::from_read(std::io::Cursor::new(icon_bytes.to_vec())) {
                    Ok(pixbuf) => {
                        let app_handle = app.handle().clone();
                        gtk::glib::idle_add_local(move || {
                            gtk::Window::set_default_icon(&pixbuf);
                            if let Some(window) = app_handle.get_webview_window("main") {
                                if let Ok(gtk_window) = window.gtk_window() {
                                    gtk_window.set_icon(Some(&pixbuf));
                                }
                            }
                            gtk::glib::ControlFlow::Break
                        });
                    }
                    Err(e) => eprintln!("md-editor: failed to load icon: {e}"),
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            read_dir,
            load_session,
            save_session,
            save_scroll_position,
            load_preferences,
            save_preferences
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
