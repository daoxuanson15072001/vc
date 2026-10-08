import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import {
  conversationAssignSchema,
  conversationTransferSchema,
  labelInputSchema,
  noteInputSchema,
  notePatchSchema,
  setLabelsSchema,
  type ConversationLabel,
  type ConversationNote,
  type ConversationPerson,
} from '@vclinks/shared';
import { CurrentSubject } from '../authz/authz.guard';
import type { Subject } from '../authz/engine';
import { parseOr400 } from '../common/zod';
import { ConversationWorkService } from './conversation-work.service';

/** Handler (claim / assign / transfer / release), internal notes and VClinks labels of a conversation. */
@Controller('conversations')
export class ConversationWorkController {
  constructor(private readonly work: ConversationWorkService) {}

  @Get(':id/people')
  people(@Param('id') id: string): Promise<ConversationPerson[]> {
    return this.work.people(id);
  }

  @Post(':id/claim')
  @HttpCode(200)
  claim(@Param('id') id: string, @CurrentSubject() s?: Subject) {
    return this.work.claim(id, s);
  }

  @Post(':id/assign')
  @HttpCode(200)
  assign(@Param('id') id: string, @Body() body: unknown, @CurrentSubject() s?: Subject) {
    const b = parseOr400(conversationAssignSchema, body);
    return this.work.setHandler(id, 'assign', b.userId, b.reason || null, s);
  }

  @Post(':id/transfer')
  @HttpCode(200)
  transfer(@Param('id') id: string, @Body() body: unknown, @CurrentSubject() s?: Subject) {
    const b = parseOr400(conversationTransferSchema, body);
    return this.work.setHandler(id, 'transfer', b.userId, b.reason, s);
  }

  @Post(':id/release')
  @HttpCode(200)
  release(@Param('id') id: string, @CurrentSubject() s?: Subject) {
    return this.work.release(id, s);
  }

  @Get(':id/notes')
  notes(@Param('id') id: string, @CurrentSubject() s?: Subject): Promise<ConversationNote[]> {
    return this.work.notes(id, s);
  }

  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body() body: unknown, @CurrentSubject() s?: Subject): Promise<ConversationNote> {
    return this.work.addNote(id, parseOr400(noteInputSchema, body), s);
  }

  @Patch(':id/notes/:noteId')
  editNote(@Param('id') id: string, @Param('noteId') noteId: string, @Body() body: unknown, @CurrentSubject() s?: Subject): Promise<ConversationNote> {
    return this.work.editNote(id, noteId, parseOr400(notePatchSchema, body).text, s);
  }

  @Delete(':id/notes/:noteId')
  @HttpCode(200)
  deleteNote(@Param('id') id: string, @Param('noteId') noteId: string, @CurrentSubject() s?: Subject) {
    return this.work.deleteNote(id, noteId, s);
  }

  @Put(':id/labels')
  @HttpCode(200)
  setLabels(@Param('id') id: string, @Body() body: unknown, @CurrentSubject() s?: Subject): Promise<ConversationLabel[]> {
    return this.work.setLabels(id, parseOr400(setLabelsSchema, body).labelIds, s);
  }
}

/** Catalog of VClinks labels (company-wide). */
@Controller('conversation-labels')
export class ConversationLabelsController {
  constructor(private readonly work: ConversationWorkService) {}

  @Get()
  list(): Promise<ConversationLabel[]> {
    return this.work.labels();
  }

  @Post()
  create(@Body() body: unknown, @CurrentSubject() s?: Subject): Promise<ConversationLabel> {
    return this.work.createLabel(parseOr400(labelInputSchema, body), s);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown, @CurrentSubject() s?: Subject): Promise<ConversationLabel> {
    return this.work.updateLabel(id, parseOr400(labelInputSchema, body), s);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Param('id') id: string, @CurrentSubject() s?: Subject) {
    return this.work.deleteLabel(id, s);
  }
}
