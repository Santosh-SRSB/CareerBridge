import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { LocationsService } from './locations.service';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Public()
  @Get('states')
  listStates() {
    return this.locations.listActiveStates();
  }

  @Public()
  @Get('cities')
  listCities(@Query('stateId') stateId?: string) {
    return this.locations.listActiveCities(stateId);
  }

  @Public()
  @Get('states/:id/cities')
  listCitiesForState(@Param('id') id: string) {
    return this.locations.listActiveCities(id);
  }
}
