import { nationFlag } from '@/lib/constants';

interface Props {
  nation: string | null;
  className?: string;
}

export function Flag({ nation, className }: Props) {
  if (!nation) return null;

  // Soviet flag: red badge with gold hammer & sickle
  if (nation === 'USSR') {
    return (
      <span
        className={
          'inline-flex items-center justify-center rounded-[2px] bg-red-700 px-[3px] py-[1px] text-[0.75em] leading-none text-yellow-300 ' +
          (className ?? '')
        }
        title="USSR"
      >
        ☭
      </span>
    );
  }

  // Handle dual-nation: split and render each
  if (nation.includes('/')) {
    const parts = nation.split('/').map((n) => n.trim());
    return (
      <span className={className}>
        {parts.map((n, i) => (
          <span key={n}>
            {i > 0 && <span className="mx-[1px]" />}
            <Flag nation={n} />
          </span>
        ))}
      </span>
    );
  }

  const emoji = nationFlag(nation);
  if (!emoji) return null;
  return <span className={className} title={nation}>{emoji}</span>;
}
