// The signature visual: an ECG-style line that literalizes "Pulse" —
// a campus heartbeat. Flat baseline with irregular spikes standing in
// for the noisy academic signals (attendance dips, deadline rushes,
// exam spikes) that the platform reads and responds to.
export default function PulseLine({ width = 400, height = 40, animated = true }) {
  const path =
    "M0,20 L40,20 L52,20 L58,6 L64,34 L70,20 L90,20 L140,20 " +
    "L152,20 L158,10 L164,30 L170,16 L176,20 L220,20 L270,20 " +
    "L282,20 L288,4 L294,36 L300,20 L340,20 L400,20";

  return (
    <svg
      className="pulse-line-wrap"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d={path} className={`pulse-line${animated ? " animated" : ""}`} />
    </svg>
  );
}
