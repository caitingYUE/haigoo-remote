
import { isExplicitlyOverseas } from '../lib/services/classification-service.js';

const locations = [
    "New York, NY / Remote",
    "United States / Remote; Remote; Boston / Remote",
    "Security Engineer, Product Security - United States / Remote; Hong Kong / Remote; Singapore / Remote; London / Remote; Amsterdam / Remote",
    "Product Manager, CRE - Remote",
    "Security Response Engineer, Incident Response - Sydney / Remote; Remote; Japan / Remote"
];

locations.forEach(loc => {
    console.log(`Location: "${loc}" -> isExplicitlyOverseas: ${isExplicitlyOverseas(loc)}`);
});
