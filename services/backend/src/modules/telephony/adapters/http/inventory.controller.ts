import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { InventoryApiErrorDto } from '@myims/contracts';
import { correlationId } from '../../../../infrastructure/execution/context';
import {
  requestPrincipal,
  httpFailure,
} from '../../../identity/adapters/http/guards';
import { HttpAccess } from '../../../identity/adapters/http/policy';
import {
  ExtensionInventory,
  type InventoryResult,
} from '../../application/extension-inventory';
interface Response {
  statusCode: number;
  setHeader(name: string, value: string): void;
}
const read = {
  access: 'protected',
  channel: 'platform-cookie',
  plane: 'platform',
  permissions: ['platform_operator'],
  sourceFailureStatus: 403,
  activity: 'passive',
} as const;
const write = { ...read, activity: 'operational' } as const;
function result(outcome: InventoryResult, response: Response) {
  if ('value' in outcome) {
    response.statusCode = outcome.kind === 'created' ? 201 : 200;
    return outcome.value;
  }
  if (outcome.kind === 'unavailable') response.setHeader('Retry-After', '1');
  if (outcome.kind === 'denied' || outcome.kind === 'unavailable')
    throw httpFailure(outcome.kind === 'denied' ? 403 : 503);
  const status =
    outcome.kind === 'invalid' ? 400 : outcome.kind === 'missing' ? 404 : 409;
  throw new HttpException(
    {
      statusCode: status,
      message:
        outcome.kind === 'invalid'
          ? 'Invalid inventory request'
          : outcome.kind === 'missing'
            ? 'Inventory resource not found'
            : 'Inventory conflict',
      ...(outcome.kind === 'invalid'
        ? { fieldErrors: outcome.fieldErrors }
        : outcome.kind === 'conflict'
          ? {
              reason: outcome.reason,
              ...(outcome.conflicts ? { conflicts: outcome.conflicts } : {}),
            }
          : {}),
    } satisfies InventoryApiErrorDto,
    status,
  );
}
function noQuery(query: Record<string, unknown>) {
  if (Object.keys(query).length)
    throw new HttpException(
      {
        statusCode: 400,
        message: 'Invalid inventory request',
        fieldErrors: { body: 'Invalid query' },
      },
      400,
    );
}
@HttpAccess(read)
@Controller('platform/pbx-nodes/:nodeId')
export class InventoryController {
  constructor(
    @Inject(ExtensionInventory) private readonly inventory: ExtensionInventory,
  ) {}
  @Get('extensions')
  async list(
    @Param('nodeId') node: string,
    @Query() query: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    return result(await this.inventory.list(node, query, false), response);
  }
  @Get('extensions/:extensionId')
  async detail(
    @Param('nodeId') node: string,
    @Param('extensionId') extension: string,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    noQuery(query);
    return result(await this.inventory.detail(node, extension), response);
  }
  @HttpAccess(write)
  @Post('extensions')
  async create(
    @Req() request: object,
    @Param('nodeId') node: string,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    noQuery(query);
    return result(
      await this.inventory.create(
        requestPrincipal(request),
        node,
        body,
        correlationId(),
        true,
      ),
      response,
    );
  }
  @Post('extensions/bulk-preview')
  async preview(
    @Param('nodeId') node: string,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    noQuery(query);
    return result(await this.inventory.preview(node, body), response);
  }
  @HttpAccess(write)
  @Post('extensions/bulk')
  async bulk(
    @Req() request: object,
    @Param('nodeId') node: string,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    noQuery(query);
    return result(
      await this.inventory.create(
        requestPrincipal(request),
        node,
        body,
        correlationId(),
        false,
      ),
      response,
    );
  }
  @HttpAccess(write)
  @Patch('extensions/:extensionId')
  async edit(
    @Req() request: object,
    @Param('nodeId') node: string,
    @Param('extensionId') extension: string,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    noQuery(query);
    return result(
      await this.inventory.edit(
        requestPrincipal(request),
        node,
        extension,
        body,
        correlationId(),
        false,
      ),
      response,
    );
  }
  @HttpAccess(write)
  @Patch('extensions/:extensionId/status')
  async status(
    @Req() request: object,
    @Param('nodeId') node: string,
    @Param('extensionId') extension: string,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    noQuery(query);
    return result(
      await this.inventory.edit(
        requestPrincipal(request),
        node,
        extension,
        body,
        correlationId(),
        true,
      ),
      response,
    );
  }
  @Get('endpoint-profiles')
  async profiles(
    @Param('nodeId') node: string,
    @Query() query: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    return result(await this.inventory.list(node, query, true), response);
  }
  @Get('endpoint-profiles/:profileId/versions/:version')
  async profile(
    @Param('nodeId') node: string,
    @Param('profileId') profile: string,
    @Param('version') version: string,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    noQuery(query);
    return result(
      await this.inventory.detail(node, profile, version),
      response,
    );
  }
  @HttpAccess(write)
  @Post('endpoint-profiles')
  async createProfile(
    @Req() request: object,
    @Param('nodeId') node: string,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    noQuery(query);
    return result(
      await this.inventory.profileCreate(
        requestPrincipal(request),
        node,
        null,
        body,
        correlationId(),
      ),
      response,
    );
  }
  @HttpAccess(write)
  @Post('endpoint-profiles/:profileId/versions')
  async versionProfile(
    @Req() request: object,
    @Param('nodeId') node: string,
    @Param('profileId') profile: string,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    noQuery(query);
    return result(
      await this.inventory.profileCreate(
        requestPrincipal(request),
        node,
        profile,
        body,
        correlationId(),
      ),
      response,
    );
  }
}
