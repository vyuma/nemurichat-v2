
type GoalProps= {
  onChange: (value: string) => void;
  isStart: boolean;
}


export function Goal({ onChange,isStart }: GoalProps) {
  const alltext = [
   "会いに行きたいな～",
   "会いに行ってもいい？",
   "一緒に勉強したいな～",
   "一緒にやるとやる気が出来るよね",
   "一緒に頑張ろうよ！",
  ]
const text = alltext[1]

    return (
          <div className="bg-white/70 flex  h-25 items-center">
            <div className="w-3   h-full" style={{background:'#F9BF8D'}} />
            {isStart ? (
                  <div className="w-full">
                    <textarea
                      onChange={(e) => onChange(e.target.value)}
                      className="w-full h-20 p-3 text-orange-800 bg-transparent border-none outline-none resize-none"
                      placeholder="目標を入力してキャラクターと共有しよう！"
                      style={{ fontSize: '16px', lineHeight: '1.5' }}
                      rows={3}
                      maxLength={200}
                      autoFocus
                    />
                  </div>
                ) : (
                  <div 
                    className="cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <p style={{
                            color: '#FF6B35',
                            fontSize: '20px',
                            fontWeight: '500',
                            fontFamily: '"Hiragino Sans", "Yu Gothic UI", "Meiryo UI", sans-serif',
                            transition: 'all 0.2s ease-in-out',
                            letterSpacing: '0.3px'
                          }} 
                          className="flex items-center px-20" 
                          >
                          {text}
                          </p>
                    </div>
                  </div>
                )}
          </div>
        
    );
  }