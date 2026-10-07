import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { CredentialActions } from '../../application/credential-actions';
import { HttpAccess } from './policy';
import { CredentialExchangeBrowser } from './credential-browser';
import { TrustedSource, type SourceRequest } from './trusted-source';
import {
  credentialFailure,
  type CredentialResponse,
} from './credential-errors';
import { httpFailure } from './http-errors';
@HttpAccess({ access: 'public' })
@Controller('credential-actions')
export class CredentialExchangeController {
  constructor(
    @Inject(CredentialActions) private readonly actions: CredentialActions,
    @Inject(CredentialExchangeBrowser)
    private readonly browser: CredentialExchangeBrowser,
    @Inject(TrustedSource) private readonly source: TrustedSource,
  ) {}
  @Get('csrf')
  csrf(
    @Req() request: SourceRequest,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: CredentialResponse,
  ) {
    if (Object.keys(query).length) throw httpFailure(403);
    return this.browser.bootstrap(request, response);
  }
  @Post('exchange')
  async exchange(
    @Req() request: SourceRequest,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: CredentialResponse,
  ) {
    if (Object.keys(query).length) throw httpFailure(403);
    this.browser.check(request, 'pre', null);
    const result = await this.actions.exchange(
      body,
      this.source.extract(request),
    );
    if (result.kind !== 'completed')
      return credentialFailure(result, response, true);
    return { completed: true };
  }
}
