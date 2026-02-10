# Marine Guardians

Videojuego 2D de supervivencia tipo arena con enfoque en conciencia ambiental.

## Estado actual

Este repositorio ahora incluye una **versión jugable en web** (HTML/CSS/JS) lista para desplegar en **Vercel**.

## Mecánicas implementadas

- Selección de personaje jugable:
  - Tortuga (defensiva)
  - Pez Globo (daño en área)
  - Caballito de Mar (control de zonas con minas)
- Oleadas de basura marina que persiguen al jugador.
- Ataque automático por personaje y habilidad activa con tecla `Espacio`.
- Economía con `eco-puntos` al limpiar basura.
- Mini-tienda entre rondas para mejorar estadísticas.
- Mensajes ambientales entre rondas.

## Controles

- Moverse: `WASD` o flechas.
- Habilidad: `Espacio`.

## Ejecutar localmente

Abre `index.html` directamente o usa un servidor local:

```bash
python3 -m http.server 4173
```

Luego visita `http://localhost:4173`.

## Despliegue en Vercel

1. Sube este repositorio a GitHub.
2. Entra a Vercel y crea un nuevo proyecto desde ese repo.
3. Vercel detectará un proyecto estático automáticamente.
4. Deploy.

Este proyecto no requiere build step ni framework adicional.
