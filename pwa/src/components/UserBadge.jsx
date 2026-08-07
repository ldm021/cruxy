/** Chip con el avatar y el nombre; toca para cambiarlos. */
export function UserBadge({ name, avatar, onEdit }) {
  return (
    <button type="button" className="user-badge" onClick={onEdit} title="Cambiar nombre o avatar">
      <span className="user-badge__avatar" aria-hidden="true">
        {avatar}
      </span>
      <span className="user-badge__name">{name}</span>
    </button>
  );
}
