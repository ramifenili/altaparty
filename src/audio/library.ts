// Biblioteca de sonidos. Todas las pistas son ORIGINALES: las genera
// scripts/generate-audio.mjs por síntesis, por lo que no tienen derechos de
// terceros y se pueden usar comercialmente. Para sumar una pista: agregar el
// archivo en public/audio y una entrada acá.

export type SoundDef = {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** wav, mp3, m4a, aac u ogg dentro de public/audio */
  file: string;
};

export const SOUNDS: SoundDef[] = [
  {
    id: "cancha-en-fiesta",
    name: "Cancha en fiesta",
    description: "Bombo de tribuna y coro de metales",
    icon: "goal",
    file: "/audio/cancha-en-fiesta.wav",
  },
  {
    id: "estrella-pop",
    name: "Estrella pop",
    description: "Synth-pop con arpegios brillantes",
    icon: "mic",
    file: "/audio/estrella-pop.wav",
  },
  {
    id: "aventura-heroica",
    name: "Aventura heroica",
    description: "Bajo intenso y cuerdas de acción",
    icon: "network",
    file: "/audio/aventura-heroica.wav",
  },
  {
    id: "paso-jurasico",
    name: "Paso jurásico",
    description: "Tambores tribales y marimba",
    icon: "footprints",
    file: "/audio/paso-jurasico.wav",
  },
  {
    id: "cielo-de-caramelo",
    name: "Cielo de caramelo",
    description: "Caja de música pastel",
    icon: "rainbow",
    file: "/audio/cielo-de-caramelo.wav",
  },
  {
    id: "cuenta-regresiva",
    name: "Cuenta regresiva",
    description: "Ambiente espacial con pulsos",
    icon: "rocket",
    file: "/audio/cuenta-regresiva.wav",
  },
  {
    id: "nivel-arcade",
    name: "Nivel arcade",
    description: "Chiptune de 8 bits",
    icon: "gamepad",
    file: "/audio/nivel-arcade.wav",
  },
  {
    id: "gala-dorada",
    name: "Gala dorada",
    description: "Vals elegante con campanitas",
    icon: "sparkles",
    file: "/audio/gala-dorada.wav",
  },
  {
    id: "verano-tropical",
    name: "Verano tropical",
    description: "Ritmo caribeño con steel drum",
    icon: "palm",
    file: "/audio/verano-tropical.wav",
  },
  {
    id: "camino-de-gloria",
    name: "Camino de gloria",
    description: "Himno de estadio con pisadas, palmas y metales",
    icon: "trophy",
    file: "/audio/camino-de-gloria.wav",
  },
  {
    id: "grito-campeon",
    name: "Grito de campeón",
    description: "Cántico de tribuna con bombo, palmas y trompetas",
    icon: "megaphone",
    file: "/audio/grito-campeon.mp3",
  },
  {
    id: "telarana",
    name: "Telaraña",
    description: "Tema de superhéroe con metales y bajo caminante",
    icon: "bug",
    file: "/audio/telarana.mp3",
  },
  {
    id: "juguetes",
    name: "Juguetes",
    description: "Ragtime juguetón con tuba y marimba",
    icon: "guitar",
    file: "/audio/juguetes.mp3",
  },
  {
    id: "velocidad",
    name: "Velocidad",
    description: "Electrónica de carrera con subidas y golpes",
    icon: "wind",
    file: "/audio/velocidad.mp3",
  },
  {
    id: "cazadoras",
    name: "Cazadoras K-pop",
    description: "K-pop de escenario con subidas, whooshes e impactos",
    icon: "mic-vocal",
    file: "/audio/cazadoras.mp3",
  },
  {
    id: "cumple-feliz",
    name: "Cumpleaños feliz",
    description: "Melodía tradicional en caja de música",
    icon: "cake",
    file: "/audio/cumple-feliz.wav",
  },
];

export function getSound(id: string) {
  return SOUNDS.find((s) => s.id === id);
}

/** Lo que el usuario eligió. `default` sigue a la plantilla activa. */
export type ActiveAudio =
  | { kind: "default" }
  | { kind: "library"; id: string }
  | {
      kind: "custom";
      file: File;
      url: string;
      name: string;
      duration: number | null;
    };

export type AudioSelection =
  | ActiveAudio
  | {
      kind: "mute";
      /** elección a restaurar al reactivar el sonido */ previous?: ActiveAudio;
    };

export type ResolvedAudio =
  | { kind: "none" }
  | { kind: "url"; url: string; label: string; ext: string }
  | { kind: "file"; file: File; url: string; label: string; ext: string };

export function resolveAudio(
  sel: AudioSelection,
  defaultSoundId: string,
): ResolvedAudio {
  switch (sel.kind) {
    case "mute":
      return { kind: "none" };
    case "custom": {
      const ext = sel.file.name.split(".").pop()?.toLowerCase() || "mp3";
      return {
        kind: "file",
        file: sel.file,
        url: sel.url,
        label: sel.name,
        ext,
      };
    }
    case "library":
    case "default": {
      const s = getSound(sel.kind === "library" ? sel.id : defaultSoundId);
      if (!s) return { kind: "none" };
      return {
        kind: "url",
        url: s.file,
        label: s.name,
        ext: s.file.split(".").pop() ?? "wav",
      };
    }
  }
}

export function formatDuration(sec: number | null) {
  if (sec === null) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
