const contentService = require("../services/contentService");
const { logAdminAction } = require("../services/adminLogService");

function handleError(res, err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Une erreur interne est survenue" });
}

async function listContent(req, res) {
    try {
        const items = await contentService.listContent(req.params.type, { status: req.query.status });
        res.json({ items });
    } catch (err) {
        handleError(res, err);
    }
}

async function getContent(req, res) {
    try {
        const item = await contentService.getContent(req.params.type, req.params.id);
        res.json({ item });
    } catch (err) {
        handleError(res, err);
    }
}

async function createContent(req, res) {
    try {
        const item = await contentService.createContent(req.params.type, req.body, req.firebaseUser);
        await logAdminAction(req, { action: "CREATE_CONTENT", targetType: req.params.type, targetId: item.id, metadata: { status: item.status } });
        res.status(201).json({ item });
    } catch (err) {
        handleError(res, err);
    }
}

async function updateContent(req, res) {
    try {
        const item = await contentService.updateContent(req.params.type, req.params.id, req.body);
        await logAdminAction(req, { action: "UPDATE_CONTENT", targetType: req.params.type, targetId: item.id, metadata: { status: item.status } });
        res.json({ item });
    } catch (err) {
        handleError(res, err);
    }
}

async function deleteContent(req, res) {
    try {
        await contentService.deleteContent(req.params.type, req.params.id);
        await logAdminAction(req, { action: "DELETE_CONTENT", targetType: req.params.type, targetId: req.params.id });
        res.json({ message: "Contenu supprimé" });
    } catch (err) {
        handleError(res, err);
    }
}

module.exports = { listContent, getContent, createContent, updateContent, deleteContent };
