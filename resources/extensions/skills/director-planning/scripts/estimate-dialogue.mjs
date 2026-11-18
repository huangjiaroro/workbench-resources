#!/usr/bin/env node
/**
 * 中文对白发声时长计算器。
 * 仅接收一个参数：纯对白文本（多句可直接合并为一个字符串）。
 * 用法：node estimate-dialogue.mjs "你说什么？我没有答应。"
 * 中文语速参考（字/秒）：
 *   舒缓 2.5–3.0；自然 3.5–4.5（默认 4.0）；快速 5.0–6.0。
 * 返回的只是发声时间，不包含静默、气口、独立动作；不决定 Shot 数量、时长配额。
 */
const argv=process.argv.slice(2);
if(argv.length!==1 || !argv[0].trim()){
 console.error('用法：node estimate-dialogue.mjs "纯对白文本（可合并多句）"');
 process.exit(1);
}
const spoken=argv[0];
// 中文汉字逐字计数，标点、空格和排版符号不计；孤立数字逐位近似发音，
// 外语单词不具有固定“中文字/秒”换算，应单独确认，不冒充准确中文时长。
const han=[...spoken.matchAll(/\p{Script=Han}/gu)].length;
const digits=[...spoken.matchAll(/[0-9０-９]/gu)].length;
const latin=[...spoken.matchAll(/[A-Za-z]+/g)].map(x=>x[0]);
const count=han+digits;
const fmt=(x)=>Number(x.toFixed(1));
const win=(low,high)=>`${fmt(count/high)}–${fmt(count/low)} 秒`;
console.log(`台词发声字数：${count}（汉字 ${han}、数字 ${digits}；不含标点）`);
console.log(`舒缓 / 克制 2.5–3.0 字/秒：${win(2.5,3.0)}`);
console.log(`自然对白 3.5–4.5 字/秒：${win(3.5,4.5)}`);
console.log(`快速 / 喜剧 5.0–6.0 字/秒：${win(5.0,6.0)}`);
console.log(`默认自然语速 4.0 字/秒：${fmt(count/4.0)} 秒`);
if(latin.length)console.log(`注意：包含 ${latin.length} 个外语单词；以上数值未计其发声时间，请按实际发音补充。`);
console.log('说明：仅为台词发声时间；表演停顿、喘息和非重叠动作由导演另行考虑。');
