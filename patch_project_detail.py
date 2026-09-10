import re

with open('src/components/ProjectDetail.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { IconButton, Badge, ProgressBar } from './ui';", "import { IconButton, Badge } from './ui';\nimport { Tone } from '../types';")

progress_bar_code = """
function ProgressBar({ progress, tone }: { progress: number, tone: Tone }) {
  const getColors = () => {
    switch (tone) {
      case 'lime': return 'bg-[#a3e635] text-[#3f6212]';
      case 'olive': return 'bg-[#a3b18a] text-[#344e41]';
      case 'neutral': return 'bg-tx-primary text-canvas';
      default: return 'bg-tx-primary text-canvas';
    }
  };
  return (
    <div className="w-full h-2 bg-surface-neutral rounded-full overflow-hidden">
      <div className={`h-full transition-all duration-500 ease-out ${getColors()}`} style={{ width: `${progress}%` }} />
    </div>
  );
}
"""

content = content + "\n" + progress_bar_code

with open('src/components/ProjectDetail.tsx', 'w') as f:
    f.write(content)
