import { useState } from 'react';

const AVATARS = ['🙂', '😎', '🦊', '🐨', '🐙', '🦉', '🐝', '🌻', '⚡', '🍀', '🎈', '🧩'];

/** Pantalla inicial: elegir nombre y avatar. Sin registro ni contraseñas. */
export function NamePrompt({ initialName = '', initialAvatar = '🙂', onSubmit }) {
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState(initialAvatar);

  return (
    <div className="onboarding">
      <div className="onboarding__card">
        <h1 className="onboarding__logo">🧩 Cruxy</h1>
        <p className="onboarding__lead">
          Crucigramas en familia, todos sobre la misma grilla y al mismo tiempo.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) onSubmit(name, avatar);
          }}
        >
          <label className="field">
            <span>¿Cómo te llamás?</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mario"
              maxLength={24}
              autoFocus
              required
            />
          </label>

          <fieldset className="avatars">
            <legend>Elige un avatar</legend>
            <div className="avatars__grid">
              {AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`avatar ${avatar === emoji ? 'is-active' : ''}`}
                  onClick={() => setAvatar(emoji)}
                  aria-pressed={avatar === emoji}
                  aria-label={`Avatar ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </fieldset>

          <button type="submit" className="btn btn--primary btn--block" disabled={!name.trim()}>
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
