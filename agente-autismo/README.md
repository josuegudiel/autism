# Agente Autismo

Carpeta destinada a guardar todo el contenido de la carpeta local
**AUTISMO AGENT** del escritorio.

## Cómo subir tus archivos aquí

### Opción A — Desde la web (la más fácil, sin instalar nada)

1. Abre: **https://github.com/josuegudiel/autism/upload/main/agente-autismo**
2. Arrastra tus archivos al recuadro.
3. Haz clic en el botón verde **"Commit changes"**.

### Opción B — Desde tu PC con Git (Windows PowerShell)

```powershell
cd "$HOME\Desktop\AUTISMO AGENT"
git init
git remote add origin https://github.com/josuegudiel/autism.git
git add .
git commit -m "Subir contenido de AUTISMO AGENT"
git branch -M main
git push -u origin main
```

> Nota: los archivos de más de 25 MB no se pueden subir por la web; para esos
> usa la Opción B o Git LFS.
