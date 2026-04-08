import { Request, Response } from 'express';
import Note from '../models/Note';

export const getNotes = async (req: Request, res: Response) => {
  try {
    const notes = await Note.find({ owner: req.user?.id }).sort({ isPinned: -1, updatedAt: -1 });
    res.json(notes);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const createNote = async (req: Request, res: Response) => {
  try {
    const note = await Note.create({ ...req.body, owner: req.user?.id });
    res.status(201).json(note);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error.';
    res.status(400).json({ message: msg });
  }
};

export const updateNote = async (req: Request, res: Response) => {
  try {
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, owner: req.user?.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!note) return res.status(404).json({ message: 'Note not found.' });
    res.json(note);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error.';
    res.status(400).json({ message: msg });
  }
};

export const deleteNote = async (req: Request, res: Response) => {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, owner: req.user?.id });
    if (!note) return res.status(404).json({ message: 'Note not found.' });
    res.json({ message: 'Note deleted.' });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};

export const pinNote = async (req: Request, res: Response) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, owner: req.user?.id });
    if (!note) return res.status(404).json({ message: 'Note not found.' });
    note.isPinned = !note.isPinned;
    await note.save();
    res.json(note);
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
};
