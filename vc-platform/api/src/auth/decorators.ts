import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Permission } from '@vc/contracts';
import type { Viewer } from './viewer';

export const PUBLIC_KEY = 'vc:public';
export const CAN_KEY = 'vc:can';

/** No token needed (health). Every other route needs a valid token, even without @Can. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Route needs this permission of 02 mục 3; scope ((p)) is checked by the service. */
export const Can = (permission: Permission) => SetMetadata(CAN_KEY, permission);

export const CurrentViewer = createParamDecorator((_: unknown, ctx: ExecutionContext): Viewer => ctx.switchToHttp().getRequest().viewer);
