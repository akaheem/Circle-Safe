// Reference usage of the Lightfall hero background (TEMPLATE palette shown).
// When building, REPLACE the colors/backgroundColor/color1..3 with CircleSafe's
// chosen palette (see PROGRESS.md "FRONTEND DESIGN INPUTS").
import Lightfall from './Lightfall';

export default function HeroBackgroundExample() {
  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      <Lightfall
        colors={['#A6C8FF', '#5227FF', '#FF9FFC']}
        backgroundColor="#0A29FF"
        speed={0.5}
        streakCount={2}
        streakWidth={1}
        streakLength={1}
        glow={1}
        density={0.6}
        twinkle={1}
        zoom={3}
        backgroundGlow={0.5}
        opacity={1}
        mouseInteraction
        mouseStrength={0.5}
        mouseRadius={1}
        color1="#A6C8FF"
        color2="#5227FF"
        color3="#FF9FFC"
      />
    </div>
  );
}
