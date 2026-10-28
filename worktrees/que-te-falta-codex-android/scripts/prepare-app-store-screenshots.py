from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = ROOT / "app-store-screenshots"
UPLOAD_DIR = ROOT / "PARA-SUBIR-A-APPLE"
UPLOAD_DIR_69 = ROOT / "PARA-SUBIR-A-APPLE-6.9"
SOURCE_SUFFIX = "-500x1082"
PRIMARY_TARGET_SIZE = (1242, 2688)
LARGE_TARGET_SIZE = (1290, 2796)
EXPECTED_FILES = {
    "01-lista-habitual.png",
    "02-voy-a-comprar.png",
    "03-caducidades.png",
    "04-comprados.png",
    "05-historial.png",
}


def main() -> None:
    sources = sorted(SCREENSHOTS.glob(f"*{SOURCE_SUFFIX}.png"))
    targets = {source.name.replace(SOURCE_SUFFIX, "") for source in sources}
    if targets != EXPECTED_FILES:
        missing = sorted(EXPECTED_FILES - targets)
        unexpected = sorted(targets - EXPECTED_FILES)
        raise SystemExit(
            f"Capturas incompletas. Faltan: {missing or 'ninguna'}. "
            f"Sobran: {unexpected or 'ninguna'}."
        )

    UPLOAD_DIR.mkdir(exist_ok=True)
    UPLOAD_DIR_69.mkdir(exist_ok=True)
    source_ratio = 500 / 1082

    for source in sources:
        filename = source.name.replace(SOURCE_SUFFIX, "")
        with Image.open(source) as image:
            source_image = image.convert("RGB")
            if abs((source_image.width / source_image.height) - source_ratio) > 0.001:
                raise ValueError(f"{source.name}: proporción inesperada {image.size}")

            for folder, target_size in (
                (SCREENSHOTS, PRIMARY_TARGET_SIZE),
                (UPLOAD_DIR, PRIMARY_TARGET_SIZE),
                (UPLOAD_DIR_69, LARGE_TARGET_SIZE),
            ):
                target_ratio = target_size[0] / target_size[1]
                crop_width = round(source_image.height * target_ratio)
                prepared_source = source_image
                if crop_width < source_image.width:
                    left = (source_image.width - crop_width) // 2
                    prepared_source = source_image.crop((left, 0, left + crop_width, source_image.height))
                prepared = prepared_source.resize(target_size, Image.Resampling.LANCZOS)
                target = folder / filename
                prepared.save(target, format="PNG", optimize=True)
            print(
                f"{filename}: {PRIMARY_TARGET_SIZE[0]}x{PRIMARY_TARGET_SIZE[1]} "
                f"y {LARGE_TARGET_SIZE[0]}x{LARGE_TARGET_SIZE[1]}"
            )


if __name__ == "__main__":
    main()
