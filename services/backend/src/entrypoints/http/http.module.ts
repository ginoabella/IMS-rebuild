import { Controller, Get, Module } from '@nestjs/common';

@Controller()
class FoundationController {
  @Get()
  foundation() {
    return { application: 'MyIMS', status: 'foundation', operational: false };
  }
}

@Module({ controllers: [FoundationController] })
export class HttpModule {}
