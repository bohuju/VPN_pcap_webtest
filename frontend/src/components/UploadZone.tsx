import { useCallback, useState } from 'react';

export default function UploadZone() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setMessage('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.filename}`);
      } else {
        setMessage(`❌ ${data.detail}`);
      }
    } catch {
      setMessage('❌ 上传失败');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.pcap') || file.name.endsWith('.pcapng'))) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-slate-600 rounded-lg p-3 text-center cursor-pointer hover:border-slate-400 transition-colors"
    >
      <input
        type="file"
        accept=".pcap,.pcapng"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }}
        className="hidden"
        id="upload-input"
      />
      <label htmlFor="upload-input" className="cursor-pointer block">
        <div className="text-2xl mb-1">📤</div>
        <div className="text-xs text-slate-400">
          {uploading ? '解析中...' : '拖放或点击上传'}
        </div>
        <div className="text-xs text-slate-500">.pcap / .pcapng</div>
      </label>
      {message && <div className="mt-1 text-xs">{message}</div>}
    </div>
  );
}
