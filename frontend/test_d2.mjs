import { D2 } from '@terrastruct/d2';

const d2 = new D2();
await d2.init();
const result = await d2.render('x -> y', { layout: 'elk', theme: 0 });
console.log(typeof result, result?.substring?.(0, 100) ?? result);