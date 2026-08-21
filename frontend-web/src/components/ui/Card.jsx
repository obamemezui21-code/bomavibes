function Card({ as: As = 'div', solid = true, className = '', children, ...props }) {
  return (
    <As className={`${solid ? 'glass-panel-solid' : 'glass-panel'} rounded-2xl ${className}`} {...props}>
      {children}
    </As>
  )
}

export default Card
