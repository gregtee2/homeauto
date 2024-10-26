// /backend/src/validation/graphValidation.js

const Joi = require('joi');

const graphSchema = Joi.object({
    nodes: Joi.array().items(
        Joi.object({
            id: Joi.string().required(),
            type: Joi.string().required(),
            properties: Joi.object().required(),
            // Add other necessary validations based on your node structure
        })
    ),
    connections: Joi.array().items(
        Joi.object({
            origin_id: Joi.string().required(),
            origin_slot: Joi.string().required(),
            target_id: Joi.string().required(),
            target_slot: Joi.string().required(),
        })
    )
});

module.exports = graphSchema;
