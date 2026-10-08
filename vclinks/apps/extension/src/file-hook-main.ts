// Entry of the MAIN-world bundle (file-hook.js); see file-hook.ts and contact-id-stamp.ts.
import { installContactIdStamp } from './contact-id-stamp';
import { installFileHook } from './file-hook';

installFileHook(window);
installContactIdStamp(window);
