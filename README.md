# Cruxy

Este repositorio tiene **dos proyectos separados**, cada uno en su carpeta:

## 📱 [`pwa/`](./pwa) — Crucigramas colaborativos en familia *(activo)*

Progressive Web App para resolver crucigramas de revista entre varias personas,
en tiempo real, desde el celular. Se saca una foto del crucigrama, Claude extrae
la grilla y las pistas, y todos escriben sobre la misma grilla viendo las letras
de los demás al instante.

- **Frontend:** React + Vite, instalable como PWA en Android y iPhone
- **Backend:** Firebase (Firestore, Storage, Cloud Functions, Cloud Messaging)
- **Extracción de la foto:** API de Claude con visión

👉 **[Guía de instalación y despliegue](./pwa/README.md)**

## 🧩 [`legacy-generator/`](./legacy-generator) — Generador de crucigramas *(anterior)*

El trabajo previo: un generador de crucigramas en Python + Flask, con su propia
interfaz web y sus scripts de validación. Se mantiene tal cual estaba, solo
movido a su carpeta.

```bash
cd legacy-generator
./run.sh          # http://localhost:5000
```

Su documentación original está en
[`legacy-generator/README.md`](./legacy-generator/README.md) y
[`legacy-generator/QUICKSTART.md`](./legacy-generator/QUICKSTART.md).

> Los dos proyectos son independientes: no comparten código ni dependencias.
> Cada uno se ejecuta desde su propia carpeta.
