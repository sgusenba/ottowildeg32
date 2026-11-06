"""PlatformIO-Vorskript: kopiert die Web-App (ohne Explorer, Tests, Dev-Server) nach esp32/data.

Der Explorer braucht Web Bluetooth und läuft nicht über die Bridge. Die Dateien in data/ landen
beim Upload (`pio run -t uploadfs`) im LittleFS des ESP32.
"""
import pathlib
import shutil

Import("env")  # noqa: F821  (von PlatformIO bereitgestellt)

project = pathlib.Path(env["PROJECT_DIR"])  # noqa: F821
web = project.parent / "web"
data = project / "data"

shutil.rmtree(data, ignore_errors=True)
data.mkdir(parents=True)
for name in ("index.html", "style.css"):
    shutil.copy2(web / name, data / name)
shutil.copytree(web / "js", data / "js")
print(f"sync_web: {sum(1 for _ in data.rglob('*') if _.is_file())} Dateien nach {data}")
