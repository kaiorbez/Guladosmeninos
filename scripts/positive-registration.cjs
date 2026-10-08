function claimsPositiveRegistration(value) {
 return String(value||'').split(/[.!?\n]+/).some(sentence=>{
  const claim=/(?:pedido|encomenda|solicitud).{0,35}(?:registrad[oa]|cadastrad[oa])|(?:registr[eé]|registrei|cadastr[ée]i).{0,30}(?:pedido|encomenda|solicitud)/iu.test(sentence);
  const negative=/(?:n[aã]o|no|a[uú]n no|todav[ií]a no|ainda n[aã]o|sem|sin|antes de|precis[oa]|necesito|falta).{0,70}(?:registr|cadastr)/iu.test(sentence);
  const conditional=/(?:se |si |quando |cuando |ap[oó]s |depois de |despu[eé]s de ).{0,50}(?:registr|cadastr)/iu.test(sentence);
  return claim&&!negative&&!conditional;
 });
}
module.exports={claimsPositiveRegistration};
