const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET a specific setting value
router.get('/:key', async(req, res) => {
    try {
        const [rows] = await db.execute('SELECT setting_value FROM system_settings WHERE setting_key = ?', [req.params.key]);
        if (rows.length > 0) {
            res.json({ value: rows[0].setting_value });
        } else {
            // Return default values for known settings
            if (req.params.key === 'locker_price') {
                res.json({ value: '1500' });
            } else if (req.params.key === 'bank_account_number') {
                res.json({ value: '123-456-7890' });
            } else {
                res.status(404).json({ message: 'Setting not found' });
            }
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching setting', error });
    }
});

// PUT update a specific setting value (admin only)
router.put('/:key', authenticateToken, async(req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin role required.' });
        }

        const { value } = req.body;
        const settingKey = req.params.key;

        if (!value) {
            return res.status(400).json({ message: 'Setting value is required' });
        }

        // Check if setting exists
        const [existingRows] = await db.execute('SELECT setting_key FROM system_settings WHERE setting_key = ?', [settingKey]);

        if (existingRows.length > 0) {
            // Update existing setting
            await db.execute('UPDATE system_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?', [value, settingKey]);
        } else {
            // Insert new setting
            await db.execute('INSERT INTO system_settings (setting_key, setting_value, updated_at) VALUES (?, ?, NOW())', [settingKey, value]);
        }

        res.json({
            message: 'Setting updated successfully',
            key: settingKey,
            value: value
        });
    } catch (error) {
        console.error('Error updating setting:', error);
        res.status(500).json({ message: 'Error updating setting', error: error.message });
    }
});

module.exports = router;