import Controls from "./Controls";


export default function PlayerArea() {
return (
<main className="flex-1 flex flex-col bg-slate-900">
<div className="flex-1 flex items-center justify-center">
<div className="w-[480px] h-[480px] bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center">
<span className="text-slate-400">Preview area</span>
</div>
</div>
<Controls />
</main>
);
}