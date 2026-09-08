import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserType } from '../prisma/client';
import { CandidatesService } from './candidates.service';
import {
  EducationDto,
  ExperienceDto,
  PreferencesDto,
  SkillDto,
  UpdateCandidateDto,
  UpdateEducationDto,
  UpdateExperienceDto,
  SavePassportDto,
  CertificationDto,
  ProjectDto,
} from './dto/update-candidate.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('candidates')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserType.CANDIDATE)
@Controller(['candidates', 'candidate'])
export class CandidatesController {
  constructor(private readonly candidates: CandidatesService) {}

  @Get(['me', 'profile'])
  me(@CurrentUser() user: { id: string }) {
    return this.candidates.me(user.id);
  }

  @Get('me/completion')
  completion(@CurrentUser() user: { id: string }) {
    return this.candidates.completion(user.id);
  }

  @Put(['me', 'profile'])
  updateMe(@CurrentUser() user: { id: string }, @Body() dto: UpdateCandidateDto) {
    return this.candidates.updateMe(user.id, dto);
  }

  @Put('me/passport')
  savePassport(@CurrentUser() user: { id: string }, @Body() dto: SavePassportDto) {
    return this.candidates.savePassport(user.id, dto);
  }

  @Patch('me')
  patchMe(@CurrentUser() user: { id: string }, @Body() dto: UpdateCandidateDto) {
    return this.candidates.updateMe(user.id, dto);
  }

  @Put('me/preferences')
  updatePreferences(@CurrentUser() user: { id: string }, @Body() dto: PreferencesDto) {
    return this.candidates.updateMe(user.id, dto);
  }

  @Get(['me/education', 'education'])
  listEducation(@CurrentUser() user: { id: string }) {
    return this.candidates.listEducation(user.id);
  }

  @Post(['me/education', 'education'])
  addEducation(@CurrentUser() user: { id: string }, @Body() dto: EducationDto) {
    return this.candidates.addEducation(user.id, dto);
  }

  @Put(['me/education/:id', 'education/:id'])
  updateEducation(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateEducationDto,
  ) {
    return this.candidates.updateEducation(user.id, id, dto);
  }

  @Delete(['me/education/:id', 'education/:id'])
  removeEducation(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.candidates.removeEducation(user.id, id);
  }

  @Get(['me/skills', 'skills'])
  listSkills(@CurrentUser() user: { id: string }) {
    return this.candidates.listSkills(user.id);
  }

  @Post(['me/skills', 'skills'])
  addSkill(@CurrentUser() user: { id: string }, @Body() dto: SkillDto) {
    return this.candidates.addSkill(user.id, dto);
  }

  @Delete(['me/skills/:id', 'skills/:id'])
  removeSkill(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.candidates.removeSkill(user.id, id);
  }

  @Get(['me/experience', 'experience'])
  listExperience(@CurrentUser() user: { id: string }) {
    return this.candidates.listExperience(user.id);
  }

  @Post(['me/experience', 'experience'])
  addExperience(@CurrentUser() user: { id: string }, @Body() dto: ExperienceDto) {
    return this.candidates.addExperience(user.id, dto);
  }

  @Put(['me/experience/:id', 'experience/:id'])
  updateExperience(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateExperienceDto,
  ) {
    return this.candidates.updateExperience(user.id, id, dto);
  }

  @Delete(['me/experience/:id', 'experience/:id'])
  removeExperience(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.candidates.removeExperience(user.id, id);
  }

  @Post('me/certifications')
  addCertification(@CurrentUser() user: { id: string }, @Body() dto: CertificationDto) {
    return this.candidates.addCertification(user.id, dto);
  }

  @Delete('me/certifications/:id')
  removeCertification(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.candidates.removeCertification(user.id, id);
  }

  @Post('me/projects')
  addProject(@CurrentUser() user: { id: string }, @Body() dto: ProjectDto) {
    return this.candidates.addProject(user.id, dto);
  }

  @Delete('me/projects/:id')
  removeProject(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.candidates.removeProject(user.id, id);
  }
}
